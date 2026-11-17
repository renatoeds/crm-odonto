import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { clinicErrorMessage, type Patient } from "@/hooks/useClinicData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CONDITIONS = [
  "Diabetes",
  "Hipertensão",
  "Problema cardíaco",
  "Uso de anticoagulante",
  "Gestante",
  "Fumante",
  "Problema de coagulação",
  "Reação a anestesia",
];

type Anamnesis = { condicoes?: string[]; observacoes?: string };

type FormState = {
  full_name: string;
  cpf: string;
  birth_date: string;
  sex: string;
  phone: string;
  phone_secondary: string;
  email: string;
  whatsapp_opt_in: boolean;
  health_insurance: string;
  health_insurance_number: string;
  origin: string;
  notes: string;
  responsible_name: string;
  responsible_phone: string;
  responsible_cpf: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_district: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  allergies: string;
  medications: string;
  condicoes: string[];
  observacoes: string;
  status: string;
};

function toForm(patient: Patient | null): FormState {
  const anamnesis = ((patient?.anamnesis ?? {}) as unknown as Anamnesis) || {};
  return {
    full_name: patient?.full_name || "",
    cpf: patient?.cpf || "",
    birth_date: patient?.birth_date || "",
    sex: patient?.sex || "",
    phone: patient?.phone || "",
    phone_secondary: patient?.phone_secondary || "",
    email: patient?.email || "",
    whatsapp_opt_in: patient?.whatsapp_opt_in ?? true,
    health_insurance: patient?.health_insurance || "",
    health_insurance_number: patient?.health_insurance_number || "",
    origin: patient?.origin || "",
    notes: patient?.notes || "",
    responsible_name: patient?.responsible_name || "",
    responsible_phone: patient?.responsible_phone || "",
    responsible_cpf: patient?.responsible_cpf || "",
    address_street: patient?.address_street || "",
    address_number: patient?.address_number || "",
    address_complement: patient?.address_complement || "",
    address_district: patient?.address_district || "",
    address_city: patient?.address_city ?? "Macapá",
    address_state: patient?.address_state ?? "AP",
    address_zip: patient?.address_zip || "",
    allergies: patient?.allergies || "",
    medications: patient?.medications || "",
    condicoes: Array.isArray(anamnesis.condicoes) ? anamnesis.condicoes : [],
    observacoes: typeof anamnesis.observacoes === "string" ? anamnesis.observacoes : "",
    status: patient?.status || "ativo",
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

export function PatientDialog({ open, onOpenChange, patient }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => toForm(patient));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(toForm(patient));
  }, [open, patient]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof FormState, label: string, props: { type?: string; placeholder?: string; className?: string } = {}) => (
    <div className={`space-y-1.5 ${props.className || ""}`}>
      <Label htmlFor={`patient-${key}`}>{label}</Label>
      <Input id={`patient-${key}`} type={props.type || "text"} placeholder={props.placeholder}
        value={form[key] as string} onChange={(event) => set(key, event.target.value as never)} />
    </div>
  );

  const save = async () => {
    if (!form.full_name.trim()) {
      toast.error("Informe o nome completo do paciente.");
      return;
    }
    setSaving(true);
    const anamnesis: Anamnesis = { condicoes: form.condicoes, observacoes: form.observacoes.trim() };
    const payload = {
      full_name: form.full_name.trim(),
      cpf: orNull(form.cpf),
      birth_date: orNull(form.birth_date),
      sex: orNull(form.sex),
      phone: orNull(form.phone),
      phone_secondary: orNull(form.phone_secondary),
      email: orNull(form.email),
      whatsapp_opt_in: form.whatsapp_opt_in,
      health_insurance: orNull(form.health_insurance),
      health_insurance_number: orNull(form.health_insurance_number),
      origin: orNull(form.origin),
      notes: orNull(form.notes),
      responsible_name: orNull(form.responsible_name),
      responsible_phone: orNull(form.responsible_phone),
      responsible_cpf: orNull(form.responsible_cpf),
      address_street: orNull(form.address_street),
      address_number: orNull(form.address_number),
      address_complement: orNull(form.address_complement),
      address_district: orNull(form.address_district),
      address_city: orNull(form.address_city),
      address_state: orNull(form.address_state),
      address_zip: orNull(form.address_zip),
      allergies: orNull(form.allergies),
      medications: orNull(form.medications),
      anamnesis: anamnesis as unknown as Json,
      status: form.status,
    };
    const { error } = patient
      ? await supabase.from("patients").update(payload).eq("id", patient.id)
      : await supabase.from("patients").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(clinicErrorMessage(error, "Não foi possível salvar o paciente."));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["patients"] });
    toast.success(patient ? "Paciente atualizado" : "Paciente cadastrado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? "Editar paciente" : "Novo paciente"}</DialogTitle>
          <DialogDescription>Os dados de saúde ficam visíveis apenas para a equipe e toda alteração é registrada na auditoria.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="endereco">Endereço e responsável</TabsTrigger>
            <TabsTrigger value="saude">Saúde</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="grid gap-4 sm:grid-cols-2">
            {text("full_name", "Nome completo *", { className: "sm:col-span-2" })}
            {text("cpf", "CPF", { placeholder: "000.000.000-00" })}
            {text("birth_date", "Data de nascimento", { type: "date" })}
            <div className="space-y-1.5">
              <Label htmlFor="patient-sex">Sexo</Label>
              <select id="patient-sex" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.sex} onChange={(event) => set("sex", event.target.value)}>
                <option value="">Não informado</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            {text("email", "E-mail", { type: "email" })}
            {text("phone", "Telefone / WhatsApp", { placeholder: "(96) 90000-0000" })}
            {text("phone_secondary", "Telefone secundário")}
            {text("health_insurance", "Convênio")}
            {text("health_insurance_number", "Número da carteirinha")}
            {text("origin", "Como conheceu a clínica", { placeholder: "Indicação, Instagram, Google..." })}
            <div className="space-y-1.5">
              <Label htmlFor="patient-status">Situação</Label>
              <select id="patient-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={(event) => set("status", event.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={form.whatsapp_opt_in} onCheckedChange={(checked) => set("whatsapp_opt_in", checked === true)} />
              Aceita receber mensagens da clínica pelo WhatsApp
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="patient-notes">Observações gerais</Label>
              <Textarea id="patient-notes" rows={3} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
            </div>
          </TabsContent>
          <TabsContent value="endereco" className="grid gap-4 sm:grid-cols-2">
            {text("address_street", "Rua / avenida", { className: "sm:col-span-2" })}
            {text("address_number", "Número")}
            {text("address_complement", "Complemento")}
            {text("address_district", "Bairro")}
            {text("address_zip", "CEP")}
            {text("address_city", "Cidade")}
            {text("address_state", "UF")}
            <p className="text-sm font-medium sm:col-span-2">Responsável (para menores de idade)</p>
            {text("responsible_name", "Nome do responsável", { className: "sm:col-span-2" })}
            {text("responsible_phone", "Telefone do responsável")}
            {text("responsible_cpf", "CPF do responsável")}
          </TabsContent>
          <TabsContent value="saude" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="patient-allergies">Alergias</Label>
              <Textarea id="patient-allergies" rows={2} value={form.allergies} onChange={(event) => set("allergies", event.target.value)} placeholder="Medicamentos, látex, anestésicos..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient-medications">Medicamentos em uso</Label>
              <Textarea id="patient-medications" rows={2} value={form.medications} onChange={(event) => set("medications", event.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Condições informadas pelo paciente</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONDITIONS.map((condition) => (
                  <label key={condition} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.condicoes.includes(condition)}
                      onCheckedChange={(checked) => set("condicoes", checked === true
                        ? [...form.condicoes, condition]
                        : form.condicoes.filter((item) => item !== condition))} />
                    {condition}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient-anamnesis">Outras informações da anamnese</Label>
              <Textarea id="patient-anamnesis" rows={4} value={form.observacoes} onChange={(event) => set("observacoes", event.target.value)} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
