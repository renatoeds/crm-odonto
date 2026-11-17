// Datas e horas da clínica. Macapá segue o horário de Belém (UTC-03:00, sem horário de verão).
export const CLINIC_TZ = "America/Belem";
const CLINIC_OFFSET = "-03:00";

/** Dia de hoje na clínica, no formato AAAA-MM-DD. */
export function todayInClinic(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TZ }).format(new Date());
}

/** Início e fim (exclusivo) de um dia da clínica, em ISO. */
export function clinicDayRange(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00${CLINIC_OFFSET}`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00${CLINIC_OFFSET}`);
  date.setTime(date.getTime() + delta * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TZ }).format(date);
}

export function formatClinicTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatClinicDay(day: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    .format(new Date(`${day}T12:00:00${CLINIC_OFFSET}`));
}

export function formatBirthDate(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function ageFromBirthDate(value: string | null): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const [ty, tm, td] = todayInClinic().split("-").map(Number);
  const age = ty - year - (tm < month || (tm === month && td < day) ? 1 : 0);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

/** Converte dia (AAAA-MM-DD) e hora (HH:MM) da clínica em ISO. */
export function clinicDateTimeToIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00${CLINIC_OFFSET}`).toISOString();
}
