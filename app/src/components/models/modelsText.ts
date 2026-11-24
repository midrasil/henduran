/** Textos e utilitários da tela Modelos (docs/ui-ux/14-modelos.md). */

/** Nota de qualidade por quantização (protótipo aprovado `docs/ui-ux/prototipos/modelos.html`). */
export const QUALITY_NOTE: Record<string, string> = {
  Q2_K: "Qualidade baixa. Só se não couber outra.",
  Q3_K_M: "Qualidade razoável, bem leve.",
  Q4_K_M: "Bom equilíbrio. A escolha mais comum.",
  Q5_K_M: "Qualidade alta, um pouco maior.",
  Q6_K: "Qualidade muito alta, grande.",
  Q8_0: "Quase sem perda, o maior.",
};

/** Quantização marcada como Recomendado nos arquivos de um repositório. */
export const RECOMMENDED_QUANT = "Q4_K_M";

export function qualityNote(quant: string | null | undefined): string | null {
  if (!quant) return null;
  const note = QUALITY_NOTE[quant.toUpperCase()];
  return note ? `${quant.toUpperCase()}: ${note}` : null;
}

/** Texto para comparar na busca: sem acentos, hífens, espaços nem caixa. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Nome do modelo para exibir (sem a extensão `.gguf`). */
export function displayName(name: string): string {
  return name.replace(/\.gguf$/i, "");
}

export function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "falha desconhecida";
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

/** Contextos oferecidos no diálogo Carregar (4.096 a 32.768 tokens). */
export const CONTEXT_OPTIONS = [4096, 8192, 16384, 32768] as const;
