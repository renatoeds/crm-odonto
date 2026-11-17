import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Patient = Tables<"patients">;
export type Dentist = Tables<"dentists">;
export type Chair = Tables<"chairs">;
export type Procedure = Tables<"procedures">;
export type Appointment = Tables<"appointments">;

/** Mensagem amigável para os erros de banco mais comuns nas telas clínicas. */
export function clinicErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message || "";
  if (code === "23P01") return "Já existe um agendamento nesse horário para este dentista ou esta cadeira.";
  if (code === "23505" && /cpf/i.test(message)) return "Já existe um paciente cadastrado com este CPF.";
  if (code === "23503") return "Este registro está em uso e não pode ser removido.";
  if (code === "42501") return "Você não tem permissão para esta ação.";
  return message || fallback;
}

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: async (): Promise<Patient[]> => {
      const { data, error } = await supabase.from("patients").select("*").order("full_name").limit(1000);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useDentists() {
  return useQuery({
    queryKey: ["dentists"],
    queryFn: async (): Promise<Dentist[]> => {
      const { data, error } = await supabase.from("dentists").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useChairs() {
  return useQuery({
    queryKey: ["chairs"],
    queryFn: async (): Promise<Chair[]> => {
      const { data, error } = await supabase.from("chairs").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useProcedures() {
  return useQuery({
    queryKey: ["procedures"],
    queryFn: async (): Promise<Procedure[]> => {
      const { data, error } = await supabase.from("procedures").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAppointments(start: string, end: string, dentistId: string | null) {
  return useQuery({
    queryKey: ["appointments", start, end, dentistId],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Appointment[]> => {
      let query = supabase.from("appointments").select("*").gte("starts_at", start).lt("starts_at", end).order("starts_at");
      if (dentistId) query = query.eq("dentist_id", dentistId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
