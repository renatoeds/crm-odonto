import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

const SETTINGS_KEYS = ["clinica_nome", "clinica_info", "clinica_valores"] as const;

export default function ClinicSettingsTab() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [info, setInfo] = useState("");
  const [valores, setValores] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.from("system_settings").select("key, value").in("key", [...SETTINGS_KEYS]);
        if (error) throw error;
        const map: Record<string, string> = {};
        (data || []).forEach((row) => { map[row.key] = row.value || ""; });
        setNome(map.clinica_nome || "");
        setInfo(map.clinica_info || "");
        setValores(map.clinica_valores || "");
      } catch (error) {
        console.error("clinic_settings_load_failed", error);
        toast.error("Não foi possível carregar as informações da clínica");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    const rows = [
      { key: "clinica_nome", value: nome.trim() },
      { key: "clinica_info", value: info.trim() },
      { key: "clinica_valores", value: valores.trim() },
    ];
    const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar as informações da clínica", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["clinic-identity"] });
    await queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
    toast.success("Informações da clínica salvas");
  };

  if (loading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando informações da clínica...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificação da clínica</CardTitle>
          <CardDescription>Informações oficiais exibidas no CRM e usadas como referência no atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinic-name">Nome da clínica</Label>
            <Input id="clinic-name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome oficial da clínica" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-info">Endereço, horário de funcionamento e especialidades</Label>
            <Textarea id="clinic-info" rows={8} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Endereço, dias e horários de atendimento, especialidades e convênios aceitos." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-values">Valores de referência</Label>
            <Textarea id="clinic-values" rows={6} value={valores} onChange={(e) => setValores(e.target.value)} placeholder={"Ex.:\nAvaliação: ...\nLimpeza: ..."} />
            <p className="text-xs text-muted-foreground">Os preços por procedimento usados nos orçamentos ficam no catálogo de procedimentos.</p>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" />Salvar informações da clínica
        </Button>
      </div>
    </div>
  );
}
