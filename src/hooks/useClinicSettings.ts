import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseSchedule } from "@/lib/clinicSchedule";

/** Todas as configurações da clínica (tabela system_settings) como um mapa chave → valor. */
export function useClinicSettings() {
  return useQuery({
    queryKey: ["clinic-settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("system_settings").select("key, value");
      if (error) throw error;
      return Object.fromEntries((data || []).map((row) => [row.key, row.value ?? ""]));
    },
  });
}

export function useClinicSchedule() {
  const { data } = useClinicSettings();
  return useMemo(() => parseSchedule(data || {}), [data]);
}
