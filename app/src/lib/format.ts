/** Formatação de textos da interface em português do Brasil. */
import { BackendError, type FieldError } from "../api/backend";
import { DEFAULT_PERIOD, PERIODS, type DayPeriod } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Data e hora de um salvamento (ISO 8601 em UTC) na hora local, de forma legível:
 * "Hoje, 14:27", "Ontem, 09:05" ou "23 de nov. de 2026, 14:27".
 */
export function formatSavedAt(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "nunca";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (sameDay(date, now)) return `Hoje, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return `Ontem, ${time}`;
  const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return `${day}, ${time}`;
}

/** Data de um backup (`AAAAMMDD-HHMMSS`, já em hora local) como "23/11/2026 às 14:27:05". */
export function formatBackupDate(stamp: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!m) return stamp;
  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}:${m[6]}`;
}

/** Período do dia vindo do serviço; desconhecido ou ausente vira o padrão. */
export function toPeriod(value: string | null | undefined): DayPeriod {
  return PERIODS.includes(value as DayPeriod) ? (value as DayPeriod) : DEFAULT_PERIOD;
}

/** Lista em português: "a", "a e b", "a, b e c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** "1 em 3, 6 em 2 e 6 em 1" a partir das contagens de um perfil ou distribuição. */
export function describeCounts(counts: { value: number; count: number }[]): string {
  return joinList(counts.filter((c) => c.count > 0).map((c) => `${c.count} em ${c.value}`));
}

/** Conta quantas vezes cada valor aparece (`[4, 3, 3]` → `{4: 1, 3: 2}`). */
export function countValues(values: number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
  return out;
}

/** Mensagem de um erro qualquer (do serviço ou não). */
export function describeError(error: unknown, fallback = "falha desconhecida"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Erros por campo, agrupados pelo caminho (`name`, `places[0].name`...). */
export function errorsByField(errors: FieldError[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of errors) {
    const list = out.get(e.field) ?? [];
    list.push(e.message);
    out.set(e.field, list);
  }
  return out;
}

/** Mensagens claras para os erros de abrir uma Jornada; o resto usa a mensagem do serviço. */
const OPEN_ERRORS: Record<string, string> = {
  jornada_bloqueada: "Esta Jornada está aberta em outra janela do Henduran. Feche a outra janela e tente de novo.",
  banco_danificado: "O arquivo desta Jornada está danificado. Na tela Jornadas, você pode restaurar um backup.",
  banco_vazio: "O arquivo desta Jornada está vazio ou danificado. Na tela Jornadas, você pode restaurar um backup.",
  sem_resumo: "O arquivo desta Jornada está incompleto. Na tela Jornadas, você pode restaurar um backup.",
  banco_mais_novo: "Esta Jornada foi salva por uma versão mais nova do Henduran. Atualize o app para abri-la.",
  mundo_ausente: "O Mundo desta Jornada não existe mais, então ela não pode ser aberta.",
  versao_ausente: "A versão do Mundo usada por esta Jornada não existe mais.",
  mundo_danificado: "O Mundo desta Jornada está danificado, então ela não pode ser aberta.",
  mundo_mais_novo: "O Mundo desta Jornada é de uma versão mais nova do Henduran. Atualize o app.",
  jornada_nao_encontrada: "Esta Jornada não foi encontrada. Ela pode ter sido excluída.",
  storage_unavailable: "O armazenamento de Jornadas não está disponível no serviço local.",
};

export function openErrorMessage(error: unknown): string {
  const code = error instanceof BackendError ? error.code : undefined;
  return (code && OPEN_ERRORS[code]) || describeError(error, "Não foi possível abrir a Jornada.");
}

/** Aviso de uma Jornada da lista que não está utilizável. */
export const STATUS_LABEL: Record<string, string> = {
  ok: "Pronta",
  danificada: "Danificada",
  mais_nova: "De uma versão mais nova",
  sem_mundo: "Sem Mundo",
};

export const STATUS_NOTICE: Record<string, string> = {
  danificada: "O arquivo desta Jornada está danificado. Restaure um backup na tela Jornadas.",
  mais_nova: "Esta Jornada foi salva por uma versão mais nova do Henduran. Atualize o app para abri-la.",
  sem_mundo: "O Mundo desta Jornada não existe mais ou não pode ser lido.",
};
