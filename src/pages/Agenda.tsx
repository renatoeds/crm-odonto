import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clinicErrorMessage, useAppointments, useChairs, useDentists, usePatients, useProcedures, type Appointment } from "@/hooks/useClinicData";
import { APPOINTMENT_KINDS, AppointmentDialog } from "@/components/clinic/AppointmentDialog";
import { clinicDayRange, formatClinicDay, formatClinicTime, shiftDay, todayInClinic } from "@/lib/clinicTime";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const STATUS: Record<string, { label: string; className: string }> = {
  agendada: { label: "Agendada", className: "border-blue-200 bg-blue-50 text-blue-800" },
  confirmada: { label: "Confirmada", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  em_atendimento: { label: "Em atendimento", className: "border-violet-200 bg-violet-50 text-violet-800" },
  realizada: { label: "Realizada", className: "border-slate-200 bg-slate-100 text-slate-700" },
  faltou: { label: "Faltou", className: "border-amber-200 bg-amber-50 text-amber-800" },
  cancelada: { label: "Cancelada", className: "border-rose-200 bg-rose-50 text-rose-800" },
  remarcada: { label: "Remarcada", className: "border-slate-200 bg-slate-100 text-slate-700" },
};

// Próximos passos possíveis a partir de cada situação.
const NEXT: Record<string, { status: string; label: string }[]> = {
  agendada: [{ status: "confirmada", label: "Confirmar" }, { status: "em_atendimento", label: "Iniciar" }, { status: "faltou", label: "Faltou" }],
  confirmada: [{ status: "em_atendimento", label: "Iniciar" }, { status: "faltou", label: "Faltou" }],
  em_atendimento: [{ status: "realizada", label: "Concluir" }],
  faltou: [{ status: "agendada", label: "Reabrir" }],
};

export default function Agenda() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [day, setDay] = useState(() => {
    const requested = searchParams.get("dia") || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : todayInClinic();
  });
  const [dentistFilter, setDentistFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetPatient, setPresetPatient] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const range = useMemo(() => clinicDayRange(day), [day]);
  const appointments = useAppointments(range.start, range.end, dentistFilter || null);
  const patients = usePatients();
  const dentists = useDentists();
  const procedures = useProcedures();
  const chairs = useChairs();

  const patientById = useMemo(() => new Map((patients.data || []).map((item) => [item.id, item])), [patients.data]);
  const dentistById = useMemo(() => new Map((dentists.data || []).map((item) => [item.id, item])), [dentists.data]);
  const procedureById = useMemo(() => new Map((procedures.data || []).map((item) => [item.id, item])), [procedures.data]);
  const chairById = useMemo(() => new Map((chairs.data || []).map((item) => [item.id, item])), [chairs.data]);

  // Atalho "Agendar" da tela de pacientes: /agenda?paciente=<id>
  const requestedPatient = searchParams.get("paciente");
  useEffect(() => {
    if (!requestedPatient) return;
    setPresetPatient(requestedPatient);
    setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [requestedPatient, setSearchParams]);

  const openNew = () => { setPresetPatient(null); setDialogOpen(true); };

  const updateStatus = async (appointment: Appointment, status: string, reason?: string) => {
    setBusyId(appointment.id);
    const { error } = await supabase.from("appointments")
      .update(status === "cancelada" ? { status, cancel_reason: reason } : { status })
      .eq("id", appointment.id);
    setBusyId(null);
    if (error) {
      toast.error(clinicErrorMessage(error, "Não foi possível atualizar o agendamento."));
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    await queryClient.invalidateQueries({ queryKey: ["available-slots"] });
    toast.success(`Agendamento: ${STATUS[status]?.label.toLowerCase() || status}`);
    return true;
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    if (!cancelReason.trim()) return void toast.error("Informe o motivo do cancelamento.");
    if (await updateStatus(cancelling, "cancelada", cancelReason.trim())) {
      setCancelling(null);
      setCancelReason("");
    }
  };

  const list = appointments.data || [];
  const activeCount = list.filter((item) => ["agendada", "confirmada", "em_atendimento"].includes(item.status)).length;
  const noDentists = !dentists.isLoading && !(dentists.data || []).some((dentist) => dentist.active);

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="mt-1 text-sm capitalize text-slate-600">{formatClinicDay(day)}</p>
        </div>
        <Button onClick={openNew} disabled={noDentists}><Plus className="mr-2 h-4 w-4" />Novo agendamento</Button>
      </div>

      {noDentists && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Nenhum dentista ativo cadastrado. {isAdmin
            ? <Link to="/configuracoes" className="font-medium underline">Cadastre em Configurações › Dentistas</Link>
            : "Peça a um administrador para cadastrar em Configurações › Dentistas."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setDay(shiftDay(day, -1))} aria-label="Dia anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <Input aria-label="Data da agenda" type="date" className="w-44" value={day} onChange={(event) => event.target.value && setDay(event.target.value)} />
        <Button size="icon" variant="outline" onClick={() => setDay(shiftDay(day, 1))} aria-label="Próximo dia"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setDay(todayInClinic())}>Hoje</Button>
        <select aria-label="Filtrar por dentista" className="h-10 rounded-md border bg-background px-3 text-sm" value={dentistFilter} onChange={(event) => setDentistFilter(event.target.value)}>
          <option value="">Todos os dentistas</option>
          {(dentists.data || []).map((dentist) => <option key={dentist.id} value={dentist.id}>{dentist.name}</option>)}
        </select>
        <span className="text-sm text-slate-600">{activeCount} ativo{activeCount === 1 ? "" : "s"} · {list.length} no dia</span>
      </div>

      <div className="mt-4 space-y-2">
        {appointments.isLoading && <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Carregando agenda...</p>}
        {appointments.isError && <p className="rounded-xl border bg-white p-4 text-sm text-red-700">Não foi possível carregar a agenda.</p>}
        {!appointments.isLoading && !appointments.isError && !list.length && (
          <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-600">Nenhum agendamento neste dia.</p>
        )}
        {list.map((appointment) => {
          const patient = patientById.get(appointment.patient_id);
          const dentist = dentistById.get(appointment.dentist_id);
          const procedure = appointment.procedure_id ? procedureById.get(appointment.procedure_id) : null;
          const chair = appointment.chair_id ? chairById.get(appointment.chair_id) : null;
          const status = STATUS[appointment.status] || { label: appointment.status, className: "border-slate-200 bg-slate-100 text-slate-700" };
          const closed = ["cancelada", "realizada", "remarcada"].includes(appointment.status);
          return (
            <article key={appointment.id} className={`flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4 ${closed ? "opacity-70" : ""}`}
              style={{ borderLeft: `4px solid ${dentist?.color || "#0EA5E9"}` }}>
              <div className="w-28 shrink-0">
                <p className="text-lg font-semibold">{formatClinicTime(appointment.starts_at)}</p>
                <p className="text-xs text-slate-600">até {formatClinicTime(appointment.ends_at)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{patient?.full_name || "Paciente não encontrado"}</p>
                <p className="text-sm text-slate-600">
                  {APPOINTMENT_KINDS[appointment.kind] || appointment.kind}
                  {procedure ? ` · ${procedure.name}` : ""}
                  {dentist ? ` · ${dentist.name}` : ""}
                  {chair ? ` · ${chair.name}` : ""}
                </p>
                {patient?.phone && <p className="text-xs text-slate-600">{patient.phone}</p>}
                {patient?.allergies && <p className="text-xs font-medium text-red-700">Alergia: {patient.allergies}</p>}
                {appointment.notes && <p className="mt-1 text-sm text-slate-700">{appointment.notes}</p>}
                {appointment.status === "cancelada" && appointment.cancel_reason && <p className="mt-1 text-sm text-rose-700">Motivo: {appointment.cancel_reason}</p>}
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
              <div className="flex flex-wrap gap-2">
                {(NEXT[appointment.status] || []).map((step) => (
                  <Button key={step.status} size="sm" variant="outline" disabled={busyId === appointment.id}
                    onClick={() => void updateStatus(appointment, step.status)}>{step.label}</Button>
                ))}
                {["agendada", "confirmada"].includes(appointment.status) && (
                  <Button size="sm" variant="ghost" className="text-rose-700" disabled={busyId === appointment.id}
                    onClick={() => { setCancelling(appointment); setCancelReason(""); }}>Cancelar</Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <AppointmentDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultDay={day} defaultPatientId={presetPatient}
        patients={patients.data || []} dentists={dentists.data || []} procedures={procedures.data || []} chairs={chairs.data || []} />

      <Dialog open={!!cancelling} onOpenChange={(open) => { if (!open) setCancelling(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
            <DialogDescription>O horário volta a ficar livre na agenda. O motivo fica registrado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Motivo *</Label>
            <Input id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ex.: paciente pediu para remarcar" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>Voltar</Button>
            <Button variant="destructive" disabled={!!busyId} onClick={() => void confirmCancel()}>Cancelar agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
