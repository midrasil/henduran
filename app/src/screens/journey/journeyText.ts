/** Textos da tela da Jornada (só apresentação: nenhum valor de regra mora aqui). */
import type { JourneyEvent } from "../../api/journeyScreen";
import type { CalendarDate, RuleAttribute } from "../../api/journeys";
import { toPeriod } from "../../lib/format";
import { PERIOD_LABEL } from "../../ui";

/** "12 de Alvorim, Solário · Ano 476" (ADR-076, item 16). */
export function calendarText(calendar: CalendarDate | null | undefined): string | null {
  if (!calendar) return null;
  const weekday = calendar.weekday_name ? `, ${calendar.weekday_name}` : "";
  const era = calendar.era_label ? ` · ${calendar.era_label}` : "";
  return `${calendar.day} de ${calendar.month_name}${weekday}${era}`;
}

/** Momento de um evento do Log: "12 de Alvorim · Noite". */
export function eventMoment(event: Pick<JourneyEvent, "calendar" | "day_period">): string {
  const period = event.day_period ? PERIOD_LABEL[toPeriod(event.day_period)] : null;
  const date = event.calendar ? `${event.calendar.day} de ${event.calendar.month_name}` : null;
  return [date, period].filter(Boolean).join(" · ");
}

const field = (data: Record<string, unknown>, key: string): string => {
  const v = data[key];
  return typeof v === "string" ? v : "";
};

export interface EventLine {
  /** Tipo em texto curto ("Cena aberta"). */
  label: string;
  text: string;
  /** Texto a mais (o resumo de uma Cena encerrada). */
  detail: string | null;
}

/** Linha do Log para cada tipo de evento do motor (backend/README.md, `GET /events`). */
export function eventLine(event: JourneyEvent, characterName: string): EventLine {
  const d = event.data ?? {};
  switch (event.kind) {
    case "cena_aberta":
      return { label: "Cena aberta", text: field(d, "title") || "Cena", detail: field(d, "place_name") || null };
    case "cena_encerrada":
      return { label: "Cena encerrada", text: field(d, "title") || "Cena", detail: field(d, "summary") || null };
    case "lugar":
      return {
        label: d.new_place ? "Lugar novo" : "Lugar",
        text: `${characterName} foi para ${field(d, "place_name") || "um lugar"}`,
        detail: field(d, "previous_place_name") ? `Antes: ${field(d, "previous_place_name")}` : null,
      };
    case "cena_renomeada":
      return {
        label: "Cena renomeada",
        text: field(d, "title"),
        detail: field(d, "previous_title") ? `Antes: ${field(d, "previous_title")}` : null,
      };
    default:
      return { label: event.kind, text: "", detail: null };
  }
}

/** Estado de uma Ambição em texto (a Ambição é feminina). */
export function ambitionStatusLabel(status: string | null): string | null {
  switch (status) {
    case null:
    case "ativo":
      return null;
    case "concluido":
      return "concluída";
    case "abandonado":
      return "abandonada";
    case "impossivel":
      return "impossível";
    case "sem_sentido":
      return "sem sentido";
    default:
      return status;
  }
}

/** Abreviação de três letras do Atributo, a partir do nome do catálogo ("Determinação" → "DET"). */
export function attributeAbbrev(attribute: Pick<RuleAttribute, "name"> | undefined, fallback = ""): string {
  const name = attribute?.name ?? fallback;
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
