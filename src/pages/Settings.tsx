import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Building2, Plug, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssistantSettingsTab from "@/components/settings/AssistantSettingsTab";
import ClinicSettingsTab from "@/components/settings/ClinicSettingsTab";
import DentistsSettingsTab from "@/components/settings/DentistsSettingsTab";
import GeneralSettingsTab from "@/components/settings/GeneralSettingsTab";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground">Gerencie os dados da clínica, os dentistas, a atendente virtual e as integrações.</p>
          </div>
        </div>

        <Tabs defaultValue="clinica" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-4">
            <TabsTrigger value="clinica" className="gap-2 py-2.5"><Building2 className="h-4 w-4" />Clínica</TabsTrigger>
            <TabsTrigger value="dentistas" className="gap-2 py-2.5"><Stethoscope className="h-4 w-4" />Dentistas</TabsTrigger>
            <TabsTrigger value="atendente" className="gap-2 py-2.5"><Bot className="h-4 w-4" />Atendente virtual</TabsTrigger>
            <TabsTrigger value="integracoes" className="gap-2 py-2.5"><Plug className="h-4 w-4" />Integrações</TabsTrigger>
          </TabsList>
          <TabsContent value="clinica"><ClinicSettingsTab /></TabsContent>
          <TabsContent value="dentistas"><DentistsSettingsTab /></TabsContent>
          <TabsContent value="atendente"><AssistantSettingsTab /></TabsContent>
          <TabsContent value="integracoes"><GeneralSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
