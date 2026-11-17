import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clinicErrorMessage, type Chair, type Dentist, type Patient, type Procedure } from "@/hooks/useClinicData";
import { clinicDateTimeToIso, formatClinicTime } from "@/lib/clinicTime";
import { useClinicSchedule } from "@/hooks/useClinicSettings";
import { fitsSchedule, weekdayOfDay } from "@/lib/clinicSchedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

export const APPOINTMENT_KINDS: Record<string, string> = {
  avaliacao: "Avaliação",
  procedimento: "Procedimento",
  retorno: "Retorno",
  urgencia: "Urgência",
  manutencao: "Manutenção",
};

const SOURCES: Record<string, string> = {
  manual: "Lançado pela equipe",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  presencial: "Presencial",
};

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function AppointmentDialog({ open, onOpenChange, defaultDay, defaultPatientId, patients, dentists, procedures, chairs }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDay: string;
  defaultPatientId: string | null;
  patients: Patient[];
  dentists: Dentist[];
  procedures: Procedure[];
  chairs: Chair[];
}) {
  const queryClient = useQueryClient();
  const schedule = useClinicSchedule();
  const activeDentists = useMemo(() => dentists.filter((dentist) => dentist.active), [dentists]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [dentistId, setDentistId] = useState("");
  const [kind, setKind] = useState("avaliacao");
  const [procedureId, setProcedureId] = useState("");
  const [duration, setDuration] = useState(30);
  const [day, setDay] = useState(defaultDay);
  const [slot, setSlot] = useState("");
  const [manual, setManual] = useState(false);
  const [manualTime, setManualTime] = useState("08:00");
  const [chairId, setChairId] = useState("");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId);
    setPatientSearch("");
    setDentistId(activeDentists.length === 1 ? activeDentists[0].id : "");
    setKind("avaliacao");
    setProcedureId("");
    setDuration(30);
    setDay(defaultDay);
    setSlot("");
    setManual(false);
    setManualTime("08:00");
    setChairId(chairs.length === 1 ? chairs[0].id : "");
    setSource("manual");
    setNotes("");
    // Só reinicia ao abrir; as listas não devem apagar o que já foi digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedPatient = patients.find((patient) => patient.id === patientId) || null;
  const matches = useMemo(() => {
    const term = patientSearch.trim().toLocaleLowerCase("pt-BR");
    if (term.length < 2) return [];
    const termDigits = term.replace(/\D/g, "");
    return patients.filter((patient) => patient.status === "ativo" && (
      patient.full_name.toLocaleLowerCase("pt-BR").includes(term)
      || (termDigits.length >= 3 && (patient.phone || "").replace(/\D/g, "").includes(termDigits))
    )).slice(0, 6);
  }, [patients, patientSearch]);

  const slots = useQuery({
    queryKey: ["available-slots", dentistId, day, duration, schedule.open, schedule.close, schedule.lunchStart, schedule.lunchEnd, schedule.days.join(",")],
    enabled: open && !manual && !!dentistId && !!day && duration >= 5,
    queryFn: async () => {
      if (!schedule.days.includes(weekdayOfDay(day))) return [];
      const { data, error } = await supabase.rpc("available_slots", {
        p_dentist_id: dentistId,
        p_day: day,
        p_duration_min: duration,
        p_open: schedule.open,
        p_close: schedule.close,
      });
      if (error) throw error;
      return (data || []).filter((item) => fitsSchedule(item.slot_start, duration, schedule));
    },
  });

  useEffect(() => { setSlot(""); }, [dentistId, day, duration, manual]);

  const chooseProcedure = (id: string) => {
    setProcedureId(id);
    const procedure = procedures.find((item) => item.id === id);
    if (procedure?.default_duration_min) setDuration(procedure.default_duration_min);
  };

  const save = async () => {
    if (!patientId) return void toast.error("Selecione o paciente.");
    if (!dentistId) return void toast.error("Selecione o dentista.");
    if (!day) return void toast.error("Informe a data.");
    if (!Number.isFinite(duration) || duration < 5 || duration > 600) return void toast.error("A duração deve ficar entre 5 minutos e 10 horas.");
    const startsAt = manual ? (manualTime ? clinicDateTimeToIso(day, manualTime) : "") : slot;
    if (!startsAt) return void toast.error("Escolha o horário.");
    const endsAt = new Date(Date.parse(startsAt) + duration * 60_000).toISOString();
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId,
      dentist_id: dentistId,
      chair_id: chairId || null,
      procedure_id: procedureId || null,
      kind,
      starts_at: startsAt,
      ends_at: endsAt,
      source,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(clinicErrorMessage(error, "Não foi possível salvar o agendamento."));
      void slots.refetch();
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    await queryClient.invalidateQueries({ queryKey: ["available-slots"] });
    toast.success("Agendamento criado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>O sistema não permite dois agendamentos ativos no mesmo horário para o mesmo dentista ou cadeira.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="appointment-patient">Paciente *</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border bg-emerald-50 px-3 py-2 text-sm">
                <span><strong>{selectedPatient.full_name}</strong>{selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}</span>
                <Button size="sm" variant="ghost" onClick={() => setPatientId(null)} aria-label="Trocar paciente"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <>
                <Input id="appointment-patient" placeholder="Digite o nome ou o telefone" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
                {patientSearch.trim().length >= 2 && (
                  <div className="rounded-md border">
                    {matches.length ? matches.map((patient) => (
                      <button key={patient.id} type="button" className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                        onClick={() => { setPatientId(patient.id); setPatientSearch(""); }}>
                        {patient.full_name}{patient.phone ? <span className="text-slate-600"> · {patient.phone}</span> : null}
                      </button>
                    )) : <p className="px-3 py-2 text-sm text-slate-600">Nenhum paciente encontrado. Cadastre-o primeiro na tela Pacientes.</p>}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-dentist">Dentista *</Label>
            <select id="appointment-dentist" className={selectClass} value={dentistId} onChange={(event) => setDentistId(event.target.value)}>
              <option value="">Selecione</option>
              {activeDentists.map((dentist) => <option key={dentist.id} value={dentist.id}>{dentist.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-kind">Tipo</Label>
            <select id="appointment-kind" className={selectClass} value={kind} onChange={(event) => setKind(event.target.value)}>
              {Object.entries(APPOINTMENT_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-procedure">Procedimento</Label>
            <select id="appointment-procedure" className={selectClass} value={procedureId} onChange={(event) => chooseProcedure(event.target.value)}>
              <option value="">Não definido</option>
              {procedures.map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-duration">Duração (minutos)</Label>
            <Input id="appointment-duration" type="number" min={5} max={600} step={5} value={duration}
              onChange={(event) => setDuration(Number(event.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-day">Data *</Label>
            <Input id="appointment-day" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-time">Horário *</Label>
            {manual ? (
              <Input id="appointment-time" type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} />
            ) : (
              <select id="appointment-time" className={selectClass} value={slot} onChange={(event) => setSlot(event.target.value)} disabled={!dentistId || slots.isLoading}>
                <option value="">
                  {!dentistId ? "Escolha o dentista" : slots.isLoading ? "Buscando horários..." : slots.isError ? "Erro ao buscar horários" : slots.data?.length ? "Selecione" : !schedule.days.includes(weekdayOfDay(day)) ? "A clínica não atende neste dia" : "Sem horários livres neste dia"}
                </option>
                {(slots.data || []).map((item) => <option key={item.slot_start} value={item.slot_start}>{formatClinicTime(item.slot_start)}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} />
              Informar outro horário (encaixe ou registro de consulta já ocorrida)
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-chair">Cadeira</Label>
            <select id="appointment-chair" className={selectClass} value={chairId} onChange={(event) => setChairId(event.target.value)}>
              <option value="">Não definida</option>
              {chairs.map((chair) => <option key={chair.id} value={chair.id}>{chair.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-source">Como foi marcado</Label>
            <select id="appointment-source" className={selectClass} value={source} onChange={(event) => setSource(event.target.value)}>
              {Object.entries(SOURCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="appointment-notes">Observações</Label>
            <Textarea id="appointment-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
