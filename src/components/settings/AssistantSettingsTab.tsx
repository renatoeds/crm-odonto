import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { parseSchedule, WEEKDAY_OPTIONS } from "@/lib/clinicSchedule";
import { AssistantSimulator } from "@/components/settings/AssistantSimulator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

const LEAD_OPTIONS = [
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "120", label: "2 horas" },
  { value: "240", label: "4 horas" },
  { value: "1440", label: "1 dia" },
];

type FormState = {
  active: boolean;
  name: string;
  days: number[];
  open: string;
  close: string;
  lunchStart: string;
  lunchEnd: string;
  lead: string;
  insurance: string;
  instructions: string;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export default function AssistantSettingsTab() {
  const queryClient = useQueryClient();
  const settings = useClinicSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings.data || form) return;
    const map = settings.data;
    const schedule = parseSchedule(map);
    setForm({
      active: map.clinica_agente_ativo === "true",
      name: map.clinica_agente_nome || "",
      days: schedule.days,
      open: schedule.open,
      close: schedule.close,
      lunchStart: schedule.lunchStart || "",
      lunchEnd: schedule.lunchEnd || "",
      lead: String(schedule.leadMinutes),
      insurance: map.clinica_convenios || "",
      instructions: map.clinica_agente_instrucoes || "",
    });
  }, [settings.data, form]);

  if (settings.isError) return <p className="p-8 text-sm text-destructive">Não foi possível carregar as configurações da atendente.</p>;
  if (!form) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const agentName = form.name.trim() || "Assistente";

  const save = async () => {
    if (!form.name.trim()) return void toast.error("Dê um nome para a atendente.");
    if (!form.days.length) return void toast.error("Marque pelo menos um dia de atendimento.");
    if (!form.open || !form.close || toMinutes(form.close) <= toMinutes(form.open)) {
      return void toast.error("O horário de fechamento precisa ser depois da abertura.");
    }
    if (!!form.lunchStart !== !!form.lunchEnd) return void toast.error("Preencha o início e o fim do intervalo, ou deixe os dois vazios.");
    if (form.lunchStart && form.lunchEnd) {
      const start = toMinutes(form.lunchStart);
      const end = toMinutes(form.lunchEnd);
      if (end <= start || start < toMinutes(form.open) || end > toMinutes(form.close)) {
        return void toast.error("O intervalo precisa ficar dentro do expediente e terminar depois de começar.");
      }
    }
    setSaving(true);
    const rows = [
      { key: "clinica_agente_ativo", value: form.active ? "true" : "false" },
      { key: "clinica_agente_nome", value: form.name.trim() },
      { key: "clinica_dias_atendimento", value: [...form.days].sort((a, b) => a - b).join(",") },
      { key: "clinica_hora_abertura", value: form.open },
      { key: "clinica_hora_fechamento", value: form.close },
      { key: "clinica_almoco_inicio", value: form.lunchStart },
      { key: "clinica_almoco_fim", value: form.lunchEnd },
      { key: "clinica_antecedencia_min", value: form.lead },
      { key: "clinica_convenios", value: form.insurance.trim() },
      { key: "clinica_agente_instrucoes", value: form.instructions.trim() },
    ];
    const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar a atendente", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
    await queryClient.invalidateQueries({ queryKey: ["clinic-identity"] });
    toast.success("Atendente salva");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atendente virtual</CardTitle>
          <CardDescription>
            Ela responde pelo WhatsApp com os dados cadastrados no CRM: informa preços, horários e convênios,
            marca e remarca avaliações e chama a equipe quando precisa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              <Label htmlFor="assistant-active" className="text-base">Responder pacientes no WhatsApp</Label>
              <p className="mt-1 text-sm text-muted-foreground">Só tem efeito depois que o WhatsApp da clínica estiver conectado ao CRM. O teste abaixo funciona mesmo desligada.</p>
            </div>
            <Switch id="assistant-active" checked={form.active} onCheckedChange={(checked) => set("active", checked)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assistant-name">Nome da atendente</Label>
            <Input id="assistant-name" className="max-w-sm" value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ex.: Clara" />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Expediente</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Dias de atendimento">
              {WEEKDAY_OPTIONS.map((day) => {
                const checked = form.days.includes(day.value);
                return (
                  <button key={day.value} type="button" aria-pressed={checked}
                    onClick={() => set("days", checked ? form.days.filter((d) => d !== day.value) : [...form.days, day.value])}
                    className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${checked ? "border-emerald-700 bg-emerald-700 text-white" : "bg-white text-slate-700 hover:bg-emerald-50"}`}>
                    {day.label}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="assistant-open">Abre às</Label>
                <Input id="assistant-open" type="time" value={form.open} onChange={(event) => set("open", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assistant-close">Fecha às</Label>
                <Input id="assistant-close" type="time" value={form.close} onChange={(event) => set("close", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assistant-lunch-start">Intervalo de</Label>
                <Input id="assistant-lunch-start" type="time" value={form.lunchStart} onChange={(event) => set("lunchStart", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assistant-lunch-end">até</Label>
                <Input id="assistant-lunch-end" type="time" value={form.lunchEnd} onChange={(event) => set("lunchEnd", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assistant-lead">Antecedência mínima</Label>
                <select id="assistant-lead" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.lead} onChange={(event) => set("lead", event.target.value)}>
                  {!LEAD_OPTIONS.some((option) => option.value === form.lead) && <option value={form.lead}>{form.lead} minutos</option>}
                  {LEAD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Vale também para os horários livres da Agenda. A antecedência só se aplica à atendente.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assistant-insurance">Convênios aceitos</Label>
            <Textarea id="assistant-insurance" rows={3} value={form.insurance} onChange={(event) => set("insurance", event.target.value)}
              placeholder="Liste os convênios aceitos. Se a clínica só atende particular, escreva isso." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assistant-instructions">Instruções adicionais</Label>
            <Textarea id="assistant-instructions" rows={4} value={form.instructions} onChange={(event) => set("instructions", event.target.value)}
              placeholder={"Ex.: Formas de pagamento aceitas, estacionamento, o que levar na primeira consulta."} />
            <p className="text-xs text-muted-foreground">
              Endereço e informações gerais ficam na aba Clínica; preços, no catálogo de procedimentos. As regras de segurança
              (não dar diagnóstico, chamar a equipe em urgências) valem sempre, mesmo que algo aqui diga o contrário.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" />Salvar atendente
            </Button>
          </div>
        </CardContent>
      </Card>

      <AssistantSimulator agentName={agentName} />
    </div>
  );
}
