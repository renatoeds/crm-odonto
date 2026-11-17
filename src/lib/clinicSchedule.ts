// Expediente da clínica. Reaproveita as mesmas regras usadas pela atendente virtual (Edge Function),
// para a agenda da equipe e a atendente oferecerem exatamente os mesmos horários.
import {
  checkSlotRules,
  parseSchedule,
  weekdayOfDay,
  type Schedule,
} from "../../supabase/functions/_shared/clinic-assistant-core";

export type { Schedule };
export { parseSchedule, weekdayOfDay };

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

/**
 * Horário livre respeita o expediente (dias, abertura, fechamento e intervalo).
 * Para a equipe a antecedência mínima não se aplica: só não oferece horário que já passou.
 */
export function fitsSchedule(slotStart: string, durationMin: number, schedule: Schedule, now = new Date()): boolean {
  return checkSlotRules(new Date(slotStart), durationMin, { ...schedule, leadMinutes: 0 }, now).ok;
}
