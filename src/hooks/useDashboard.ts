import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clinicDayOf, clinicDayRange, formatClinicTime, shiftDay, todayInClinic } from "@/lib/clinicTime";

export const FUNNEL_STAGES: { key: string; label: string }[] = [
  { key: "novo_contato", label: "Novo contato" },
  { key: "em_conversa", label: "Em conversa" },
  { key: "avaliacao_agendada", label: "Avaliação agendada" },
  { key: "avaliacao_realizada", label: "Avaliação realizada" },
  { key: "orcamento_apresentado", label: "Orçamento apresentado" },
  { key: "em_tratamento", label: "Em tratamento" },
];

export type DailyPoint = { day: string; realizadas: number; agendadas: number; perdidas: number };
export type TodayItem = { id: string; time: string; patient: string; detail: string; status: string };
export type WaitingItem = { id: string; name: string; preview: string; hours: number };

export type DashboardData = {
  today: { total: number; confirmed: number; done: number };
  waiting: number;
  newPatients: number;
  attendanceRate: number | null;
  attended: number;
  missed: number;
  daily: DailyPoint[];
  funnel: { key: string; label: string; count: number }[];
  todayList: TodayItem[];
  waitingList: WaitingItem[];
};

const KIND_LABELS: Record<string, string> = {
  avaliacao: "Avaliação", procedimento: "Procedimento", retorno: "Retorno", urgencia: "Urgência", manutencao: "Manutenção",
};

function periodDays(days: number): string[] {
  const today = todayInClinic();
  return Array.from({ length: days }, (_, index) => shiftDay(today, index - (days - 1)));
}

/** Busca todas as páginas de uma consulta (a API devolve no máximo 1.000 linhas por vez). */
async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; from < 20_000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < size) break;
  }
  return rows;
}

async function loadDashboard(days: number, dentistId: string | null): Promise<DashboardData> {
  const dayList = periodDays(days);
  const today = dayList[dayList.length - 1];
  const start = clinicDayRange(dayList[0]).start;
  const end = clinicDayRange(today).end;

  const [appointments, patients, opportunities, leads, dentists, procedures] = await Promise.all([
    fetchAllPages<{ id: string; starts_at: string; status: string; kind: string; patient_id: string; dentist_id: string; procedure_id: string | null }>((from, to) => {
      let query = supabase.from("appointments")
        .select("id, starts_at, status, kind, patient_id, dentist_id, procedure_id")
        .gte("starts_at", start).lt("starts_at", end).order("starts_at").range(from, to);
      if (dentistId) query = query.eq("dentist_id", dentistId);
      return query;
    }),
    fetchAllPages<{ id: string; full_name: string; created_at: string }>((from, to) =>
      supabase.from("patients").select("id, full_name, created_at").order("created_at").range(from, to)),
    fetchAllPages<{ stage: string }>((from, to) =>
      supabase.from("opportunities").select("stage").not("stage", "in", "(concluido,perdido)").range(from, to)),
    supabase.from("leads")
      .select("id, name, last_inbound_message, last_inbound_message_at, last_outbound_message_at, triage_status, status")
      .eq("archived", false).order("last_inbound_message_at", { ascending: false, nullsFirst: false }).limit(500),
    supabase.from("dentists").select("id, name"),
    supabase.from("procedures").select("id, name"),
  ]);
  if (leads.error) throw leads.error;
  if (dentists.error) throw dentists.error;
  if (procedures.error) throw procedures.error;

  const patientName = new Map(patients.map((patient) => [patient.id, patient.full_name]));
  const dentistName = new Map((dentists.data || []).map((dentist) => [dentist.id, dentist.name]));
  const procedureName = new Map((procedures.data || []).map((procedure) => [procedure.id, procedure.name]));

  const daily = new Map<string, DailyPoint>(dayList.map((day) => [day, { day, realizadas: 0, agendadas: 0, perdidas: 0 }]));
  let attended = 0;
  let missed = 0;
  for (const appointment of appointments) {
    const point = daily.get(clinicDayOf(appointment.starts_at));
    if (!point) continue;
    if (appointment.status === "realizada") { point.realizadas += 1; attended += 1; }
    else if (appointment.status === "faltou") { point.perdidas += 1; missed += 1; }
    else if (appointment.status === "cancelada") point.perdidas += 1;
    else if (appointment.status !== "remarcada") point.agendadas += 1;
  }

  const todayAppointments = appointments.filter((appointment) =>
    clinicDayOf(appointment.starts_at) === today && !["cancelada", "remarcada"].includes(appointment.status));
  const now = Date.now();
  const waitingLeads = (leads.data || []).filter((lead) => {
    if (lead.triage_status === "resolvido" || lead.status === "resolvido" || lead.status === "nao_convertido") return false;
    const inbound = lead.last_inbound_message_at ? Date.parse(lead.last_inbound_message_at) : NaN;
    const outbound = lead.last_outbound_message_at ? Date.parse(lead.last_outbound_message_at) : NaN;
    return Number.isFinite(inbound) && (!Number.isFinite(outbound) || inbound > outbound);
  });
  const periodStart = Date.parse(start);
  const stageCount = new Map<string, number>();
  for (const opportunity of opportunities) stageCount.set(opportunity.stage, (stageCount.get(opportunity.stage) || 0) + 1);

  return {
    today: {
      total: todayAppointments.length,
      confirmed: todayAppointments.filter((appointment) => appointment.status === "confirmada").length,
      done: todayAppointments.filter((appointment) => appointment.status === "realizada").length,
    },
    waiting: waitingLeads.length,
    newPatients: patients.filter((patient) => Date.parse(patient.created_at) >= periodStart).length,
    attendanceRate: attended + missed > 0 ? attended / (attended + missed) : null,
    attended,
    missed,
    daily: [...daily.values()],
    funnel: FUNNEL_STAGES.map((stage) => ({ ...stage, count: stageCount.get(stage.key) || 0 })),
    todayList: todayAppointments.map((appointment) => ({
      id: appointment.id,
      time: formatClinicTime(appointment.starts_at),
      patient: patientName.get(appointment.patient_id) || "Paciente",
      detail: [appointment.procedure_id ? procedureName.get(appointment.procedure_id) : KIND_LABELS[appointment.kind] || appointment.kind,
        dentistName.get(appointment.dentist_id)].filter(Boolean).join(" · "),
      status: appointment.status,
    })),
    waitingList: waitingLeads
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        preview: lead.last_inbound_message || "",
        hours: (now - Date.parse(lead.last_inbound_message_at as string)) / 3_600_000,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6),
  };
}

/** Dados fictícios, gerados no navegador, para visualizar o painel antes de haver movimento real. */
export function sampleDashboard(days: number): DashboardData {
  let seed = 20261116 + days;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const dayList = periodDays(days);
  const today = dayList[dayList.length - 1];
  let attended = 0;
  let missed = 0;
  const daily = dayList.map((day) => {
    const weekday = new Date(`${day}T12:00:00-03:00`).getUTCDay();
    if (weekday === 0) return { day, realizadas: 0, agendadas: 0, perdidas: 0 };
    const base = weekday === 6 ? 4 : 8;
    if (day === today) return { day, realizadas: 3, agendadas: 5, perdidas: 1 };
    const realizadas = Math.round(base * (0.7 + random() * 0.6));
    const perdidas = random() < 0.45 ? Math.round(random() * 2) : 0;
    attended += realizadas;
    missed += perdidas;
    return { day, realizadas, agendadas: 0, perdidas };
  });
  attended += 3;
  missed += 1;
  const funnelCounts = [14, 11, 9, 6, 5, 8];
  return {
    today: { total: 8, confirmed: 4, done: 3 },
    waiting: 5,
    newPatients: Math.round(days * 0.6),
    attendanceRate: attended / (attended + missed),
    attended,
    missed,
    daily,
    funnel: FUNNEL_STAGES.map((stage, index) => ({ ...stage, count: funnelCounts[index] })),
    todayList: [
      { id: "s1", time: "08:00", patient: "Paciente exemplo A", detail: "Avaliação · Dr. Exemplo", status: "realizada" },
      { id: "s2", time: "08:30", patient: "Paciente exemplo B", detail: "Profilaxia (limpeza) · Dr. Exemplo", status: "realizada" },
      { id: "s3", time: "09:30", patient: "Paciente exemplo C", detail: "Restauração em resina · Dr. Exemplo", status: "realizada" },
      { id: "s4", time: "10:30", patient: "Paciente exemplo D", detail: "Avaliação · Dr. Exemplo", status: "em_atendimento" },
      { id: "s5", time: "14:00", patient: "Paciente exemplo E", detail: "Tratamento de canal · Dr. Exemplo", status: "confirmada" },
      { id: "s6", time: "15:30", patient: "Paciente exemplo F", detail: "Manutenção ortodôntica · Dr. Exemplo", status: "confirmada" },
      { id: "s7", time: "16:00", patient: "Paciente exemplo G", detail: "Avaliação · Dr. Exemplo", status: "agendada" },
      { id: "s8", time: "17:00", patient: "Paciente exemplo H", detail: "Clareamento · Dr. Exemplo", status: "agendada" },
    ],
    waitingList: [
      { id: "w1", name: "Contato exemplo 1", preview: "Bom dia, vocês atendem no sábado?", hours: 5.2 },
      { id: "w2", name: "Contato exemplo 2", preview: "Quanto custa a avaliação?", hours: 2.4 },
      { id: "w3", name: "Contato exemplo 3", preview: "Preciso remarcar minha consulta de amanhã", hours: 1.1 },
      { id: "w4", name: "Contato exemplo 4", preview: "Vocês aceitam convênio?", hours: 0.6 },
      { id: "w5", name: "Contato exemplo 5", preview: "Oi, quero agendar uma limpeza", hours: 0.2 },
    ],
  };
}

export function useDashboard(days: number, dentistId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", days, dentistId],
    queryFn: () => loadDashboard(days, dentistId),
    enabled,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}
