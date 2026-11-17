// Atendente virtual da clínica.
//
// Modos:
// - "simulate": chamado pela tela de Configurações por alguém da equipe logado. Lê os dados reais
//   (horários, procedimentos, pacientes), mas não grava nada: agendamentos e repasses são simulados.
// - "lead": chamado pelo servidor (integração de WhatsApp) com a chave de serviço. Lê a conversa do
//   contato, executa as ações de verdade e devolve o texto da resposta para ser enviado.
//
// Nunca registra em log o conteúdo das mensagens: podem conter dados de saúde.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  ACTIVE_STATUSES,
  addDays,
  buildSystemPrompt,
  checkSlotRules,
  type DentistInfo,
  formatSlotLabel,
  isDay,
  KIND_LABELS,
  localParts,
  parseSchedule,
  type ProcedureInfo,
  samePhone,
  type Schedule,
  type Settings,
  shiftOf,
  spreadPick,
  type UpcomingAppointment,
  weekdayOfDay,
} from "../_shared/clinic-assistant-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_ROUNDS = 6;
const MAX_HISTORY = 24;
const STATUS_LABELS: Record<string, string> = {
  agendada: "agendada",
  confirmada: "confirmada",
  em_atendimento: "em atendimento",
};

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

type Action = { tipo: string; descricao: string; simulado: boolean; ok: boolean };

type Patient = { id: string; full_name: string; phone: string | null; lead_id: string | null };
type Appointment = {
  id: string;
  patient_id: string;
  dentist_id: string;
  procedure_id: string | null;
  kind: string;
  status: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
};

type Ctx = {
  admin: SupabaseClient;
  dryRun: boolean;
  now: Date;
  schedule: Schedule;
  dentists: DentistInfo[];
  procedures: ProcedureInfo[];
  patient: Patient | null;
  leadId: string | null;
  phone: string | null;
  actions: Action[];
  handoff: { motivo: string; urgente: boolean } | null;
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_horarios",
      description: "Busca horários livres a partir de uma data. Devolve poucas opções espalhadas em até três dias com vaga.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Primeiro dia a considerar, AAAA-MM-DD. Use hoje se a pessoa não tiver preferência." },
          turno: { type: "string", enum: ["manha", "tarde", "qualquer"], description: "Turno preferido." },
          procedimento_id: { type: "string", description: "Id do procedimento, se a pessoa já sabe o que vai fazer. Define a duração." },
          dentista_id: { type: "string", description: "Id do dentista, só se a pessoa pediu um dentista específico." },
        },
        required: ["data"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar",
      description: "Marca o horário escolhido. Use somente depois que a pessoa confirmou o resumo.",
      parameters: {
        type: "object",
        properties: {
          inicio: { type: "string", description: "Valor 'inicio' exatamente como veio de buscar_horarios." },
          dentista_id: { type: "string", description: "Id do dentista que veio junto com o horário." },
          nome_completo: { type: "string", description: "Nome completo do paciente. Obrigatório se o contato não é paciente cadastrado." },
          data_nascimento: { type: "string", description: "AAAA-MM-DD, se informada." },
          tipo: { type: "string", enum: ["avaliacao", "procedimento", "retorno", "manutencao"], description: "Primeiro atendimento é sempre avaliacao." },
          procedimento_id: { type: "string", description: "Id do procedimento, se houver." },
          observacao: { type: "string", description: "Resumo curto do motivo da consulta, sem dados de saúde detalhados." },
        },
        required: ["inicio", "dentista_id", "tipo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "meus_agendamentos",
      description: "Lista os próximos agendamentos do paciente desta conversa.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmar_agendamento",
      description: "Registra que o paciente confirmou presença.",
      parameters: {
        type: "object",
        properties: { agendamento_id: { type: "string" } },
        required: ["agendamento_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remarcar_agendamento",
      description: "Troca o horário de um agendamento do paciente por um horário livre vindo de buscar_horarios.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string" },
          novo_inicio: { type: "string", description: "Valor 'inicio' exatamente como veio de buscar_horarios." },
          dentista_id: { type: "string", description: "Id do dentista que veio junto com o novo horário." },
        },
        required: ["agendamento_id", "novo_inicio", "dentista_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_agendamento",
      description: "Cancela um agendamento do paciente.",
      parameters: {
        type: "object",
        properties: { agendamento_id: { type: "string" }, motivo: { type: "string" } },
        required: ["agendamento_id", "motivo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_para_equipe",
      description: "Passa a conversa para uma pessoa da equipe. Depois disso a atendente para de responder.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Resumo curto para a equipe, sem detalhes clínicos desnecessários." },
          urgente: { type: "boolean", description: "true para dor, inchaço, sangramento, trauma ou outra urgência." },
        },
        required: ["motivo", "urgente"],
        additionalProperties: false,
      },
    },
  },
];

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function durationFor(ctx: Ctx, procedureId: string): number {
  return ctx.procedures.find((p) => p.id === procedureId)?.default_duration_min ?? 30;
}

function dentistName(ctx: Ctx, id: string): string {
  return ctx.dentists.find((d) => d.id === id)?.name ?? "dentista";
}

/** Verifica regras de expediente e conflito com outros agendamentos ativos do dentista. */
async function validateSlot(ctx: Ctx, start: Date, durationMin: number, dentistId: string, ignoreId: string | null) {
  if (!ctx.dentists.some((d) => d.id === dentistId)) return { ok: false as const, reason: "Dentista não encontrado ou inativo." };
  const rules = checkSlotRules(start, durationMin, ctx.schedule, ctx.now);
  if (!rules.ok) return rules;
  const end = new Date(start.getTime() + durationMin * 60_000);
  let query = ctx.admin.from("appointments").select("id")
    .eq("dentist_id", dentistId)
    .in("status", ACTIVE_STATUSES)
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .limit(1);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data, error } = await query;
  if (error) throw error;
  if (data && data.length) return { ok: false as const, reason: "Esse horário não está mais livre." };
  return { ok: true as const, end };
}

async function loadPatientAppointment(ctx: Ctx, id: string): Promise<Appointment | null> {
  if (!ctx.patient || !id) return null;
  const { data, error } = await ctx.admin.from("appointments")
    .select("id, patient_id, dentist_id, procedure_id, kind, status, starts_at, ends_at, notes")
    .eq("id", id).eq("patient_id", ctx.patient.id).in("status", ACTIVE_STATUSES).maybeSingle();
  if (error) throw error;
  return (data as Appointment | null) ?? null;
}

async function upcomingFor(admin: SupabaseClient, patientId: string, now: Date, dentists: DentistInfo[], timeZone: string): Promise<UpcomingAppointment[]> {
  const { data, error } = await admin.from("appointments")
    .select("id, kind, status, starts_at, dentist_id")
    .eq("patient_id", patientId).in("status", ACTIVE_STATUSES)
    .gte("starts_at", now.toISOString()).order("starts_at").limit(5);
  if (error) throw error;
  return (data ?? []).map((a: { id: string; kind: string; status: string; starts_at: string; dentist_id: string }) => ({
    id: a.id,
    label: formatSlotLabel(new Date(a.starts_at), timeZone),
    kind: a.kind,
    dentist: dentists.find((d) => d.id === a.dentist_id)?.name ?? "dentista",
    status: STATUS_LABELS[a.status] ?? a.status,
  }));
}

async function runTool(ctx: Ctx, name: string, args: Record<string, unknown>): Promise<unknown> {
  const tz = ctx.schedule.timeZone;

  if (name === "buscar_horarios") {
    const today = localParts(ctx.now, tz).day;
    const startDay = isDay(args.data) && args.data >= today ? args.data : today;
    const procedureId = str(args.procedimento_id);
    const duration = durationFor(ctx, procedureId);
    const shift = str(args.turno) || "qualquer";
    const requestedDentist = str(args.dentista_id);
    const dentists = requestedDentist ? ctx.dentists.filter((d) => d.id === requestedDentist) : ctx.dentists;
    if (!dentists.length) return { erro: "Nenhum dentista disponível para agendamento. Transfira para a equipe." };
    if (!ctx.schedule.days.length) return { erro: "Dias de atendimento não cadastrados. Transfira para a equipe." };

    const found: { inicio: string; dentista_id: string; dentista: string; rotulo: string }[] = [];
    let daysWithSlots = 0;
    for (let i = 0; i < 21 && daysWithSlots < 3; i++) {
      const day = addDays(startDay, i);
      if (!ctx.schedule.days.includes(weekdayOfDay(day))) continue;
      const daySlots: typeof found = [];
      for (const dentist of dentists) {
        const { data, error } = await ctx.admin.rpc("available_slots", {
          p_dentist_id: dentist.id,
          p_day: day,
          p_duration_min: duration,
          p_open: ctx.schedule.open,
          p_close: ctx.schedule.close,
          p_step_min: 30,
        });
        if (error) throw error;
        for (const slot of (data ?? []) as { slot_start: string }[]) {
          const start = new Date(slot.slot_start);
          if (!checkSlotRules(start, duration, ctx.schedule, ctx.now).ok) continue;
          const slotShift = shiftOf(localParts(start, tz).minutes);
          if (shift === "manha" && slotShift !== "manha") continue;
          if (shift === "tarde" && slotShift === "manha") continue;
          daySlots.push({ inicio: start.toISOString(), dentista_id: dentist.id, dentista: dentist.name, rotulo: formatSlotLabel(start, tz) });
        }
      }
      if (!daySlots.length) continue;
      daysWithSlots += 1;
      daySlots.sort((a, b) => a.inicio.localeCompare(b.inicio));
      found.push(...spreadPick(daySlots, 3));
    }
    if (!found.length) return { horarios: [], aviso: "Sem horários livres nas próximas três semanas com esses filtros." };
    return { duracao_min: duration, horarios: found };
  }

  if (name === "agendar") {
    const dentistId = str(args.dentista_id);
    const start = new Date(str(args.inicio));
    const kind = Object.hasOwn(KIND_LABELS, str(args.tipo)) && str(args.tipo) !== "urgencia" ? str(args.tipo) : "avaliacao";
    const procedureId = ctx.procedures.some((p) => p.id === str(args.procedimento_id)) ? str(args.procedimento_id) : "";
    const duration = durationFor(ctx, procedureId);
    const fullName = str(args.nome_completo);
    const birthDate = isDay(args.data_nascimento) ? args.data_nascimento : null;
    if (!ctx.patient && fullName.split(/\s+/).filter(Boolean).length < 2) {
      return { ok: false, erro: "Peça o nome completo do paciente antes de agendar." };
    }
    const check = await validateSlot(ctx, start, duration, dentistId, null);
    if (!check.ok) return { ok: false, erro: `${check.reason} Ofereça outro horário com buscar_horarios.` };

    const label = formatSlotLabel(start, ctx.schedule.timeZone);
    const who = ctx.patient?.full_name ?? fullName;
    const summary = `${KIND_LABELS[kind]} de ${who} em ${label} com ${dentistName(ctx, dentistId)}`;
    if (ctx.dryRun) {
      ctx.actions.push({ tipo: "agendar", descricao: `Agendaria ${summary}.`, simulado: true, ok: true });
      return { ok: true, resumo: summary };
    }

    let patient = ctx.patient;
    if (!patient) {
      const { data, error } = await ctx.admin.from("patients").insert({
        full_name: fullName,
        birth_date: birthDate,
        phone: ctx.phone,
        lead_id: ctx.leadId,
        origin: "WhatsApp",
        whatsapp_opt_in: true,
      }).select("id, full_name, phone, lead_id").single();
      if (error) throw error;
      patient = data as Patient;
      ctx.patient = patient;
    }
    const { data: created, error } = await ctx.admin.from("appointments").insert({
      patient_id: patient.id,
      dentist_id: dentistId,
      procedure_id: procedureId || null,
      kind,
      starts_at: start.toISOString(),
      ends_at: check.end.toISOString(),
      source: "assistente",
      notes: str(args.observacao).slice(0, 500) || null,
    }).select("id").single();
    if (error) {
      if ((error as { code?: string }).code === "23P01") {
        return { ok: false, erro: "Esse horário acabou de ser ocupado. Ofereça outro com buscar_horarios." };
      }
      throw error;
    }

    // Funil: garante uma oportunidade aberta ligada à conversa e ao paciente.
    const ownerFilter = ctx.leadId ? `patient_id.eq.${patient.id},lead_id.eq.${ctx.leadId}` : `patient_id.eq.${patient.id}`;
    const { data: openOpps, error: oppError } = await ctx.admin.from("opportunities")
      .select("id, patient_id").or(ownerFilter).not("stage", "in", "(concluido,perdido)").limit(1);
    if (oppError) throw oppError;
    if (!openOpps?.length) {
      const { error: insertOppError } = await ctx.admin.from("opportunities").insert({
        lead_id: ctx.leadId,
        patient_id: patient.id,
        stage: kind === "avaliacao" ? "avaliacao_agendada" : "em_conversa",
        interest: str(args.observacao).slice(0, 200) || null,
      });
      if (insertOppError) throw insertOppError;
    } else if (!openOpps[0].patient_id) {
      await ctx.admin.from("opportunities").update({ patient_id: patient.id }).eq("id", openOpps[0].id);
    }

    ctx.actions.push({ tipo: "agendar", descricao: `Agendou ${summary}.`, simulado: false, ok: true });
    return { ok: true, agendamento_id: (created as { id: string }).id, resumo: summary };
  }

  if (name === "meus_agendamentos") {
    if (!ctx.patient) return { agendamentos: [], aviso: "Este contato não está cadastrado como paciente." };
    return { agendamentos: await upcomingFor(ctx.admin, ctx.patient.id, ctx.now, ctx.dentists, tz) };
  }

  if (name === "confirmar_agendamento" || name === "cancelar_agendamento" || name === "remarcar_agendamento") {
    const appointment = await loadPatientAppointment(ctx, str(args.agendamento_id));
    if (!appointment) return { ok: false, erro: "Agendamento não encontrado para este paciente. Use meus_agendamentos." };
    const currentLabel = formatSlotLabel(new Date(appointment.starts_at), tz);

    if (name === "confirmar_agendamento") {
      if (!ctx.dryRun) {
        const { error } = await ctx.admin.from("appointments").update({ status: "confirmada" }).eq("id", appointment.id);
        if (error) throw error;
      }
      ctx.actions.push({ tipo: "confirmar", descricao: `${ctx.dryRun ? "Confirmaria" : "Confirmou"} o agendamento de ${currentLabel}.`, simulado: ctx.dryRun, ok: true });
      return { ok: true };
    }

    if (name === "cancelar_agendamento") {
      const reason = str(args.motivo).slice(0, 300) || "Cancelado pelo paciente no WhatsApp";
      if (!ctx.dryRun) {
        const { error } = await ctx.admin.from("appointments").update({ status: "cancelada", cancel_reason: reason }).eq("id", appointment.id);
        if (error) throw error;
      }
      ctx.actions.push({ tipo: "cancelar", descricao: `${ctx.dryRun ? "Cancelaria" : "Cancelou"} o agendamento de ${currentLabel}.`, simulado: ctx.dryRun, ok: true });
      return { ok: true };
    }

    const dentistId = str(args.dentista_id) || appointment.dentist_id;
    const start = new Date(str(args.novo_inicio));
    const duration = Math.max(5, Math.round((Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60_000));
    const check = await validateSlot(ctx, start, duration, dentistId, appointment.id);
    if (!check.ok) return { ok: false, erro: `${check.reason} Ofereça outro horário com buscar_horarios.` };
    const newLabel = formatSlotLabel(start, tz);
    if (!ctx.dryRun) {
      const note = [appointment.notes, `Remarcado pela atendente virtual (antes: ${currentLabel}).`].filter(Boolean).join("\n");
      const { error } = await ctx.admin.from("appointments").update({
        dentist_id: dentistId,
        starts_at: start.toISOString(),
        ends_at: check.end.toISOString(),
        status: "agendada",
        confirmed_at: null,
        notes: note.slice(0, 1000),
      }).eq("id", appointment.id);
      if (error) {
        if ((error as { code?: string }).code === "23P01") return { ok: false, erro: "Esse horário acabou de ser ocupado. Ofereça outro." };
        throw error;
      }
    }
    ctx.actions.push({ tipo: "remarcar", descricao: `${ctx.dryRun ? "Remarcaria" : "Remarcou"} de ${currentLabel} para ${newLabel} com ${dentistName(ctx, dentistId)}.`, simulado: ctx.dryRun, ok: true });
    return { ok: true, novo_horario: newLabel };
  }

  if (name === "transferir_para_equipe") {
    const motivo = str(args.motivo).slice(0, 300) || "Paciente precisa de atendimento da equipe";
    const urgente = args.urgente === true;
    ctx.handoff = { motivo, urgente };
    if (!ctx.dryRun && ctx.leadId) {
      const { error } = await ctx.admin.from("leads").update({
        triage_status: "aguardando_secretaria",
        handoff_at: ctx.now.toISOString(),
        handoff_reason: motivo,
        attention_level: urgente ? "urgente" : "atencao",
        attention_reason: motivo,
      }).eq("id", ctx.leadId);
      if (error) throw error;
    }
    ctx.actions.push({
      tipo: "transferir",
      descricao: `${ctx.dryRun ? "Passaria" : "Passou"} a conversa para a equipe${urgente ? " como urgente" : ""}: ${motivo}`,
      simulado: ctx.dryRun,
      ok: true,
    });
    return { ok: true };
  }

  return { erro: `Ferramenta desconhecida: ${name}` };
}

async function callModel(apiKey: string, model: string, messages: ChatMessage[]) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: false,
      temperature: 0.4,
      max_tokens: 600,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`openai_${response.status}: ${detail}`);
  }
  const payload = await response.json() as { choices?: { message?: { content: string | null; tool_calls?: ToolCall[] } }[] };
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("openai_empty_response");
  return message;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Configuração do servidor incompleta." }, 500);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }

  const mode = body.mode;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (mode === "simulate") {
    if (!token) return json({ error: "Entre no CRM para usar o simulador." }, 401);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sessão inválida. Entre novamente no CRM." }, 401);
    const { data: isStaff, error: staffError } = await userClient.rpc("is_staff", { _user_id: userData.user.id });
    if (staffError || isStaff !== true) return json({ error: "Acesso restrito à equipe da clínica." }, 403);
  } else if (mode === "lead") {
    if (!timingSafeEqual(authHeader, `Bearer ${serviceKey}`)) return json({ error: "Não autorizado." }, 401);
  } else {
    return json({ error: "Modo inválido." }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "A chave da OpenAI ainda não foi configurada. Cadastre o secret OPENAI_API_KEY nas Edge Functions do Supabase." }, 503);
  }
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();

  try {
    const [settingsRes, dentistsRes, proceduresRes] = await Promise.all([
      admin.from("system_settings").select("key, value"),
      admin.from("dentists").select("id, name, specialty").eq("active", true).order("name"),
      admin.from("procedures").select("id, name, default_duration_min, default_price").eq("active", true).order("name"),
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (dentistsRes.error) throw dentistsRes.error;
    if (proceduresRes.error) throw proceduresRes.error;
    const settings: Settings = Object.fromEntries((settingsRes.data ?? []).map((row: { key: string; value: string }) => [row.key, row.value ?? ""]));
    const schedule = parseSchedule(settings);
    const dentists = (dentistsRes.data ?? []) as DentistInfo[];
    const procedures = ((proceduresRes.data ?? []) as ProcedureInfo[]).map((p) => ({
      ...p,
      default_price: p.default_price === null ? null : Number(p.default_price),
    }));

    // Conversa e identificação do contato.
    let leadId: string | null = null;
    let phone: string | null = null;
    let history: ChatMessage[] = [];

    if (mode === "simulate") {
      const raw = Array.isArray(body.messages) ? body.messages : [];
      if (!raw.length || raw.length > 40) return json({ error: "Envie de 1 a 40 mensagens." }, 400);
      for (const item of raw) {
        const role = (item as { role?: unknown })?.role;
        const content = str((item as { content?: unknown })?.content);
        if ((role !== "user" && role !== "assistant") || !content || content.length > 2000) {
          return json({ error: "Mensagem inválida no histórico do simulador." }, 400);
        }
        history.push(role === "user" ? { role: "user", content } : { role: "assistant", content });
      }
      if (history[history.length - 1].role !== "user") return json({ error: "A última mensagem precisa ser do paciente." }, 400);
      phone = str(body.phone) || null;
    } else {
      leadId = str(body.lead_id);
      if (!leadId) return json({ error: "lead_id obrigatório." }, 400);
      if ((settings.clinica_agente_ativo ?? "false") !== "true") return json({ skipped: "atendente_desativada" });
      const { data: lead, error: leadError } = await admin.from("leads")
        .select("id, phone, triage_status, archived").eq("id", leadId).maybeSingle();
      if (leadError) throw leadError;
      if (!lead) return json({ error: "Conversa não encontrada." }, 404);
      if (lead.archived) return json({ skipped: "conversa_arquivada" });
      if (lead.triage_status === "aguardando_secretaria") return json({ skipped: "com_a_equipe" });
      phone = lead.phone;
      const { data: messages, error: messagesError } = await admin.from("whatsapp_messages")
        .select("direction, message, timestamp, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY);
      if (messagesError) throw messagesError;
      history = ((messages ?? []) as { direction: string; message: string | null }[])
        .reverse()
        .filter((m) => str(m.message))
        .map((m) => m.direction === "inbound"
          ? { role: "user" as const, content: str(m.message).slice(0, 2000) }
          : { role: "assistant" as const, content: str(m.message).slice(0, 2000) });
      if (!history.length || history[history.length - 1].role !== "user") return json({ skipped: "sem_mensagem_nova" });
    }

    let patient: Patient | null = null;
    if (leadId) {
      const { data, error } = await admin.from("patients").select("id, full_name, phone, lead_id").eq("lead_id", leadId).maybeSingle();
      if (error) throw error;
      patient = (data as Patient | null) ?? null;
    }
    if (!patient && phone) {
      const { data, error } = await admin.from("patients").select("id, full_name, phone, lead_id")
        .eq("status", "ativo").not("phone", "is", null).limit(5000);
      if (error) throw error;
      patient = ((data ?? []) as Patient[]).find((p) => samePhone(p.phone, phone)) ?? null;
    }
    const upcoming = patient ? await upcomingFor(admin, patient.id, now, dentists, schedule.timeZone) : [];

    const ctx: Ctx = { admin, dryRun: mode === "simulate", now, schedule, dentists, procedures, patient, leadId, phone, actions: [], handoff: null };

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: buildSystemPrompt({
          clinicName: settings.clinica_nome?.trim() || "Clínica Odontológica",
          agentName: settings.clinica_agente_nome?.trim() || "Assistente",
          now,
          schedule,
          info: settings.clinica_info ?? "",
          insurance: settings.clinica_convenios ?? "",
          prices: settings.clinica_valores ?? "",
          extraInstructions: settings.clinica_agente_instrucoes ?? "",
          procedures,
          dentists,
          contact: { patientName: patient?.full_name ?? null, upcoming },
        }),
      },
      ...history,
    ];

    let reply = "";
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const message = await callModel(apiKey, model, messages);
      const calls = message.tool_calls ?? [];
      if (!calls.length) {
        reply = str(message.content);
        break;
      }
      messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(call.function.arguments || "{}");
          if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await runTool(ctx, call.function.name, args);
        } catch (error) {
          console.error("clinic_assistant_tool_failed", call.function.name, (error as { code?: string })?.code ?? "");
          result = { ok: false, erro: "Falha interna ao executar a ação. Peça desculpas e transfira para a equipe." };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    if (!reply) {
      reply = "Vou pedir para alguém da nossa equipe continuar o seu atendimento, tudo bem?";
      if (!ctx.handoff) await runTool(ctx, "transferir_para_equipe", { motivo: "A atendente virtual não conseguiu concluir a resposta.", urgente: false });
    }

    return json({
      reply,
      actions: ctx.actions,
      handoff: ctx.handoff,
      patient: ctx.patient ? { id: ctx.patient.id, name: ctx.patient.full_name } : null,
      simulated: ctx.dryRun,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "");
    console.error("clinic_assistant_failed", message.startsWith("openai_") ? message.slice(0, 120) : (error as { code?: string })?.code ?? "erro");
    if (message.startsWith("openai_401")) return json({ error: "A chave da OpenAI foi recusada. Confira o secret OPENAI_API_KEY." }, 502);
    if (message.startsWith("openai_429")) return json({ error: "A OpenAI recusou por limite de uso ou falta de crédito. Tente de novo em instantes." }, 502);
    return json({ error: "A atendente não conseguiu responder agora." }, 500);
  }
});
