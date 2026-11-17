import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clinicErrorMessage, useDentists, type Dentist } from "@/hooks/useClinicData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";

type FormState = { name: string; cro: string; specialty: string; phone: string; color: string; active: boolean };
const emptyForm: FormState = { name: "", cro: "", specialty: "", phone: "", color: "#0EA5E9", active: true };

export default function DentistsSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useDentists();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dentist | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (dentist: Dentist) => {
    setEditing(dentist);
    setForm({
      name: dentist.name,
      cro: dentist.cro || "",
      specialty: dentist.specialty || "",
      phone: dentist.phone || "",
      color: dentist.color || "#0EA5E9",
      active: dentist.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return void toast.error("Informe o nome do dentista.");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      cro: form.cro.trim() || null,
      specialty: form.specialty.trim() || null,
      phone: form.phone.trim() || null,
      color: form.color || "#0EA5E9",
      active: form.active,
    };
    const { error } = editing
      ? await supabase.from("dentists").update(payload).eq("id", editing.id)
      : await supabase.from("dentists").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(clinicErrorMessage(error, "Não foi possível salvar o dentista."));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["dentists"] });
    toast.success(editing ? "Dentista atualizado" : "Dentista cadastrado");
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Dentistas</CardTitle>
          <CardDescription>Profissionais que aparecem na agenda. Dentistas inativos continuam no histórico, mas não recebem novos agendamentos.</CardDescription>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo dentista</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando dentistas...</p>}
        {isError && <p className="text-sm text-destructive">Não foi possível carregar os dentistas.</p>}
        {!isLoading && !isError && !data?.length && <p className="text-sm text-muted-foreground">Nenhum dentista cadastrado ainda.</p>}
        {(data || []).map((dentist) => (
          <div key={dentist.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: dentist.color || "#0EA5E9" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{dentist.name}</p>
              <p className="text-xs text-muted-foreground">
                {[dentist.cro ? `CRO ${dentist.cro}` : null, dentist.specialty, dentist.phone].filter(Boolean).join(" · ") || "Sem dados complementares"}
              </p>
            </div>
            {!dentist.active && <Badge variant="secondary">Inativo</Badge>}
            <Button size="sm" variant="ghost" onClick={() => openEdit(dentist)} aria-label={`Editar ${dentist.name}`}><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar dentista" : "Novo dentista"}</DialogTitle>
            <DialogDescription>A cor identifica o profissional na agenda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dentist-name">Nome *</Label>
              <Input id="dentist-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Dr(a). Nome Sobrenome" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dentist-cro">CRO</Label>
                <Input id="dentist-cro" value={form.cro} onChange={(event) => setForm({ ...form, cro: event.target.value })} placeholder="AP-0000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dentist-phone">Telefone</Label>
                <Input id="dentist-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dentist-specialty">Especialidade</Label>
              <Input id="dentist-specialty" value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} placeholder="Clínico geral, ortodontia, implantes..." />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Label htmlFor="dentist-color">Cor</Label>
                <input id="dentist-color" type="color" className="h-9 w-14 rounded border" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                Ativo na agenda
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
