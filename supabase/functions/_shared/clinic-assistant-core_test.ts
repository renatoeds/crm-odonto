import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  buildSystemPrompt,
  checkSlotRules,
  describeDays,
  formatPrice,
  formatSlotLabel,
  isWithinBusinessHours,
  nextOpeningLabel,
  parseSchedule,
  phoneKey,
  samePhone,
  spreadPick,
  zonedToDate,
} from "./clinic-assistant-core.ts";

const schedule = parseSchedule({
  clinica_dias_atendimento: "1,2,3,4,5",
  clinica_hora_abertura: "08:00",
  clinica_hora_fechamento: "18:00",
  clinica_almoco_inicio: "12:00",
  clinica_almoco_fim: "13:00",
  clinica_antecedencia_min: "60",
  clinica_fuso: "America/Belem",
});

Deno.test("parseSchedule usa padrões seguros para valores inválidos", () => {
  const parsed = parseSchedule({ clinica_hora_abertura: "25:00", clinica_hora_fechamento: "07:00", clinica_almoco_inicio: "13:00", clinica_almoco_fim: "12:00" });
  assertEquals(parsed.open, "08:00");
  assertEquals(parsed.close, "18:00");
  assertEquals(parsed.lunchStart, null);
  assertEquals(parsed.days, [1, 2, 3, 4, 5]);
  assertEquals(parsed.leadMinutes, 60);
  assertEquals(parsed.timeZone, "America/Belem");
});

Deno.test("zonedToDate converte horário de Belém (UTC-3)", () => {
  assertEquals(zonedToDate("2026-11-18", "09:00", "America/Belem").toISOString(), "2026-11-18T12:00:00.000Z");
});

Deno.test("formatSlotLabel escreve dia da semana, data e hora locais", () => {
  assertEquals(formatSlotLabel(new Date("2026-11-18T12:00:00Z"), "America/Belem"), "quarta-feira, 18/11 às 09:00");
});

Deno.test("isWithinBusinessHours respeita dias, horário e intervalo", () => {
  assert(isWithinBusinessHours(new Date("2026-11-18T12:00:00Z"), schedule)); // qua 09:00
  assert(!isWithinBusinessHours(new Date("2026-11-18T15:30:00Z"), schedule)); // qua 12:30, intervalo
  assert(!isWithinBusinessHours(new Date("2026-11-18T22:00:00Z"), schedule)); // qua 19:00
  assert(!isWithinBusinessHours(new Date("2026-11-22T12:00:00Z"), schedule)); // domingo
});

Deno.test("checkSlotRules bloqueia horários fora das regras", () => {
  const now = new Date("2026-11-17T12:00:00Z"); // ter 09:00
  assertEquals(checkSlotRules(new Date("2026-11-18T12:00:00Z"), 30, schedule, now), { ok: true });
  assertEquals(checkSlotRules(new Date("2026-11-17T12:30:00Z"), 30, schedule, now).ok, false); // antecedência
  assertEquals(checkSlotRules(new Date("2026-11-18T14:45:00Z"), 30, schedule, now).ok, false); // invade o intervalo
  assertEquals(checkSlotRules(new Date("2026-11-18T20:45:00Z"), 30, schedule, now).ok, false); // passa das 18h
  assertEquals(checkSlotRules(new Date("2026-11-21T12:00:00Z"), 30, schedule, now).ok, false); // sábado
});

Deno.test("nextOpeningLabel aponta o próximo expediente", () => {
  assertEquals(nextOpeningLabel(new Date("2026-11-17T23:40:00Z"), schedule), "quarta-feira, 18/11 às 08:00"); // ter 20:40
  assertEquals(nextOpeningLabel(new Date("2026-11-18T15:30:00Z"), schedule), "quarta-feira, 18/11 às 13:00"); // no intervalo
  assertEquals(nextOpeningLabel(new Date("2026-11-21T12:00:00Z"), schedule), "segunda-feira, 23/11 às 08:00"); // sábado
});

Deno.test("phoneKey e samePhone ignoram formatação, código do país e nono dígito", () => {
  assertEquals(phoneKey("+55 (96) 99123-4567"), "9691234567");
  assertEquals(phoneKey("96 9123-4567"), "9691234567");
  assertEquals(phoneKey("123"), null);
  assert(samePhone("5596991234567", "(96) 9123-4567"));
  assert(samePhone("991234567", "(96) 99123-4567"));
  assert(!samePhone("(96) 99123-4567", "(91) 99123-4567"));
});

Deno.test("spreadPick espalha as opções ao longo do dia", () => {
  assertEquals(spreadPick([1, 2, 3, 4, 5, 6, 7], 3), [1, 4, 7]);
  assertEquals(spreadPick([1, 2], 3), [1, 2]);
});

Deno.test("formatPrice e describeDays", () => {
  assertEquals(formatPrice(null), "valor definido na avaliação");
  assertStringIncludes(formatPrice(150), "150,00");
  assertEquals(describeDays([1, 2, 3, 4, 5]), "seg a sex");
  assertEquals(describeDays([1, 3, 6]), "seg, qua, sáb");
});

Deno.test("buildSystemPrompt traz os dados cadastrados e avisa quando falta dentista", () => {
  const prompt = buildSystemPrompt({
    clinicName: "Clínica Teste",
    agentName: "Clara",
    now: new Date("2026-11-17T23:40:00Z"),
    schedule,
    info: "Rua A, 100",
    insurance: "",
    prices: "",
    extraInstructions: "Ofereça café.",
    procedures: [{ id: "p1", name: "Avaliação", default_duration_min: 30, default_price: null }],
    dentists: [],
    contact: { patientName: null, upcoming: [] },
  });
  assertStringIncludes(prompt, "Você é Clara, atendente virtual da Clínica Teste");
  assertStringIncludes(prompt, "fora do expediente");
  assertStringIncludes(prompt, "a partir de quarta-feira, 18/11 às 08:00");
  assertStringIncludes(prompt, "Convênios aceitos: não cadastrados");
  assertStringIncludes(prompt, "Avaliação: 30 min, valor definido na avaliação");
  assertStringIncludes(prompt, "Nenhum dentista ativo cadastrado");
  assertStringIncludes(prompt, "INSTRUÇÕES ADICIONAIS DA CLÍNICA");
});
