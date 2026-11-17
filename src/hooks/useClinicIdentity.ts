import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clinicDisplayName } from "@/lib/clinicBrand";

export function useClinicIdentity() {
  const { data } = useQuery({
    queryKey: ["clinic-identity"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings")
        .select("key, value")
        .in("key", ["clinica_nome", "clinica_agente_nome"]);
      if (error) throw error;
      return Object.fromEntries((data || []).map(({ key, value }) => [key, value]));
    },
    staleTime: 30_000,
  });
  return {
    clinicName: data?.clinica_nome || clinicDisplayName,
    agentName: data?.clinica_agente_nome || "Assistente",
  };
}
