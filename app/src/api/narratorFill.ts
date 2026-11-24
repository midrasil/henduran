/**
 * Narrador que preenche dados na Nova Jornada (`POST /narrator/fill`, ADR-077, item 3).
 *
 * Resposta em SSE (`start` e `done` com `result`, ou `error`), lida pelo mesmo parser das
 * rotas do Narrador; abortar `signal` fecha a conexão e cancela no serviço. O serviço valida
 * tudo (textos, limites, distribuição de Atributos e Perícias, HTML da História) e **não grava
 * nada**: quem aplica no formulário é a interface, com Desfazer.
 */
import type { BackendInfo } from "./backend";
import { streamNarration } from "./journeyScreen";

export type FillKind = "field" | "missing" | "attributes" | "skills" | "history";

export interface FillRequest {
  kind: FillKind;
  /** `kind: "field"`: caminho do campo (`name`, `convictions[0].text`, `journey.name`...). */
  field?: string;
  /** `kind: "missing"`: aba (`ident` ou `obj`). */
  tab?: "ident" | "obj";
  /** `kind: "history"`. */
  mode?: "write" | "continue";
  idea?: string;
  world?: { name?: string; era?: string; tone?: string; place?: string };
  character?: unknown;
  journey?: { name?: string; description?: string };
}

export interface FillResult {
  values?: Record<string, string>;
  attributes?: Record<string, number>;
  skill_profile?: string;
  skills?: Record<string, number>;
  history_html?: string;
  history?: string;
}

export async function requestFill(info: BackendInfo, body: FillRequest, signal?: AbortSignal): Promise<FillResult | null> {
  const done = await streamNarration(info, "/narrator/fill", body, {}, signal);
  if (done.reason === "cancelled") return null;
  return ((done as unknown as { result?: FillResult }).result ?? {}) as FillResult;
}
