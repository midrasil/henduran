/**
 * Cliente das rotas da tela da Jornada (backend/README.md, "API"; ADR-076):
 * mensagens por canal, abertura, regenerar e continuar, proposta de Cena,
 * encerramento, título, arcos, Log, lugares e retrato.
 *
 * As rotas do Narrador respondem em SSE com os eventos `start`, `token`,
 * `scene`, `proposal`, `proposal_error`, `done` e `error`, lidos pelo mesmo
 * parser do chat (`SseParser`) e canceláveis por `/chat/{id}/cancel`.
 * A interface só mostra: quem decide abrir, encerrar e gravar é o serviço.
 */
import { authHeaders, BackendError, baseUrl, errorFromResponse, type BackendInfo } from "./backend";
import { StreamError } from "./chatStream";
import { request } from "./engine";
import type {
  CalendarDate,
  CurrentPlace,
  JourneyMode,
  MessageChannel,
  OpenJourneySummary,
  PortraitCrop,
  PortraitInfo,
  SceneProposal,
  SceneView,
} from "./journeys";
import { SseParser, type SseEvent } from "./sse";

/* ------------------------------------------------------------------ tipos */

export type MessageRole = "narrador" | "jogador";
export type MessageStatus = "concluida" | "cancelada";

export interface JourneyMessage {
  id: number;
  channel: MessageChannel;
  scene_id: number | null;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  created_at: string;
}

export interface HistoryView {
  mode: JourneyMode;
  scene: SceneView | null;
  proposal: SceneProposal | null;
  messages: JourneyMessage[];
}

export interface ArcScene {
  id: number;
  title: string;
  day_period: string | null;
  place_name: string | null;
  status: string;
}

export interface Arc {
  objective_id: number | null;
  text: string | null;
  status: string | null;
  scenes: ArcScene[];
}

export type EventKind = "cena_aberta" | "cena_encerrada" | "lugar" | "cena_renomeada";

export interface JourneyEvent {
  id: number;
  kind: EventKind | string;
  scene_id: number | null;
  data: Record<string, unknown>;
  day_period: string | null;
  calendar: CalendarDate | null;
  created_at: string;
}

export interface PlaceItem {
  id: string;
  name: string;
  type: string;
  description: string;
  source: "mundo" | "jornada";
  scene_id: number | null;
  created_at: string | null;
  current: boolean;
}

export interface PathItem {
  place_id: string;
  name: string | null;
  scene_id: number | null;
  event_id: number | null;
  at: string | null;
}

export interface PlacesView {
  current_place_id: string | null;
  places: PlaceItem[];
  path: PathItem[];
}

/** Fim de uma geração (`event: done`); os campos dependem da rota. */
export interface NarrationDone {
  reason: "completed" | "cancelled";
  mode?: JourneyMode;
  scene?: SceneView | null;
  message?: JourneyMessage | null;
  proposal?: SceneProposal | null;
  current_place?: CurrentPlace | null;
  replaced?: boolean;
}

export interface NarrationHandlers {
  onStart?: (generationId: string) => void;
  onToken?: (text: string) => void;
  /** Cena proposta e validada, antes da narração (abertura e aceite). */
  onScene?: (scene: SceneView, proposal: SceneProposal | null) => void;
  /** O Aduran propôs uma Cena (gravada como pendente). */
  onProposal?: (proposal: SceneProposal) => void;
  /** A proposta do Aduran falhou; a resposta dele fica gravada assim mesmo. */
  onProposalError?: (code: string, message: string) => void;
}

/* ------------------------------------------------------------------ SSE */

function parseData(event: SseEvent): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(event.data);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    throw new StreamError("Resposta inválida do serviço.");
  }
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/**
 * POST com resposta SSE numa rota do Narrador da Jornada. Erros antes do
 * fluxo (409 `abertura_pendente`, `geracao_em_andamento`...) viram
 * `BackendError` com o código; um evento `error` vira `StreamError`.
 * Abortar `signal` fecha a conexão, o que também cancela a geração.
 */
export async function streamNarration(
  info: BackendInfo,
  path: string,
  body: unknown,
  handlers: NarrationHandlers = {},
  signal?: AbortSignal,
): Promise<NarrationDone> {
  const init: RequestInit = {
    method: "POST",
    headers: { ...authHeaders(info), "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body ?? {}),
  };
  if (signal) init.signal = signal;
  const response = await fetch(`${baseUrl(info)}${path}`, init);
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) throw new BackendError("resposta sem corpo");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = new SseParser();

  const handle = (event: SseEvent): NarrationDone | null => {
    const data = parseData(event);
    switch (event.event) {
      case "start":
        if (typeof data.id === "string") handlers.onStart?.(data.id);
        return null;
      case "token":
        if (typeof data.text === "string") handlers.onToken?.(data.text);
        return null;
      case "scene":
        if (data.scene && typeof data.scene === "object") {
          handlers.onScene?.(data.scene as SceneView, (data.proposal as SceneProposal | undefined) ?? null);
        }
        return null;
      case "proposal":
        if (data.proposal && typeof data.proposal === "object") handlers.onProposal?.(data.proposal as SceneProposal);
        return null;
      case "proposal_error":
        handlers.onProposalError?.(str(data.code, "proposta_invalida"), str(data.message, "O Aduran não conseguiu propor uma Cena."));
        return null;
      case "done":
        return { ...(data as Partial<NarrationDone>), reason: data.reason === "cancelled" ? "cancelled" : "completed" };
      case "error":
        throw new StreamError(str(data.message, "Erro desconhecido do serviço."), typeof data.code === "string" ? data.code : undefined);
      default:
        return null;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      const text = done ? decoder.decode() : decoder.decode(value, { stream: true });
      const events = parser.feed(text);
      if (done) events.push(...parser.end());
      for (const event of events) {
        const result = handle(event);
        if (result) return result;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  throw new StreamError("A conexão foi encerrada antes do fim da resposta.");
}

const CURRENT = "/journeys/current";
const channelBody = (channel?: MessageChannel) => (channel ? { channel } : {});

/** Cena inicial (ADR-076, itens 1 e 2). */
export const streamOpening = (info: BackendInfo, handlers?: NarrationHandlers, signal?: AbortSignal) =>
  streamNarration(info, `${CURRENT}/opening`, {}, handlers, signal);

/** Mensagem do jogador; `channel: "fora_de_cena"` com Cena aberta fala com o Aduran. */
export const streamSend = (
  info: BackendInfo,
  content: string,
  channel: MessageChannel | undefined,
  handlers?: NarrationHandlers,
  signal?: AbortSignal,
) => streamNarration(info, `${CURRENT}/messages`, { content, ...channelBody(channel) }, handlers, signal);

export const streamRegenerate = (info: BackendInfo, channel: MessageChannel | undefined, handlers?: NarrationHandlers, signal?: AbortSignal) =>
  streamNarration(info, `${CURRENT}/messages/regenerate`, channelBody(channel), handlers, signal);

export const streamContinue = (info: BackendInfo, channel: MessageChannel | undefined, handlers?: NarrationHandlers, signal?: AbortSignal) =>
  streamNarration(info, `${CURRENT}/messages/continue`, channelBody(channel), handlers, signal);

/** Aceita a proposta pendente: a Cena é narrada e gravada no fim. */
export const streamAcceptProposal = (info: BackendInfo, handlers?: NarrationHandlers, signal?: AbortSignal) =>
  streamNarration(info, `${CURRENT}/proposal/accept`, {}, handlers, signal);

/* ------------------------------------------------------------- rotas JSON */

/** Nome e descrição da Jornada aberta (nulo ou em branco: nome padrão e sem descrição). */
export const editJourney = (info: BackendInfo, body: { name?: string | null; description?: string | null }) =>
  request<{ journey: OpenJourneySummary }>(info, CURRENT, { method: "PATCH", body });

export const fetchHistory = (info: BackendInfo) => request<HistoryView>(info, `${CURRENT}/messages`);

export const rerollProposal = (info: BackendInfo) =>
  request<{ proposal: SceneProposal }>(info, `${CURRENT}/proposal/reroll`, { method: "POST" });

export const declineProposal = (info: BackendInfo) =>
  request<{ proposal: null; declined: SceneProposal | null }>(info, `${CURRENT}/proposal/decline`, { method: "POST" });

export const closeScene = (info: BackendInfo) =>
  request<{ mode: JourneyMode; scene: SceneView }>(info, `${CURRENT}/scene/close`, { method: "POST" });

export const renameScene = (info: BackendInfo, id: number, title: string) =>
  request<{ scene: SceneView }>(info, `${CURRENT}/scenes/${id}`, { method: "PATCH", body: { title } });

export const fetchScene = (info: BackendInfo, id: number) =>
  request<{ scene: SceneView; messages: JourneyMessage[] }>(info, `${CURRENT}/scenes/${id}`);

export const fetchArcs = (info: BackendInfo) => request<{ arcs: Arc[] }>(info, `${CURRENT}/arcs`);

export const fetchEvents = (info: BackendInfo, sceneId?: number | null) =>
  request<{ events: JourneyEvent[] }>(
    info,
    sceneId === undefined || sceneId === null ? `${CURRENT}/events` : `${CURRENT}/events?scene_id=${sceneId}`,
  );

export const fetchPlaces = (info: BackendInfo) => request<PlacesView>(info, `${CURRENT}/places`);

/* ------------------------------------------------------------------ retrato */

const cropQuery = (crop: PortraitCrop) =>
  `x=${encodeURIComponent(String(crop.x))}&y=${encodeURIComponent(String(crop.y))}&zoom=${encodeURIComponent(String(crop.zoom))}`;

/** Envia a imagem original com o enquadramento (PNG, JPEG ou WebP até 20 MB; o serviço confere). */
export async function uploadPortrait(info: BackendInfo, image: Blob, crop: PortraitCrop): Promise<PortraitInfo> {
  const response = await fetch(`${baseUrl(info)}${CURRENT}/portrait?${cropQuery(crop)}`, {
    method: "PUT",
    headers: { ...authHeaders(info), "Content-Type": image.type || "application/octet-stream" },
    body: image,
  });
  if (!response.ok) throw await errorFromResponse(response);
  return ((await response.json()) as { portrait: PortraitInfo }).portrait;
}

/** Refaz o enquadramento sem reenviar a imagem. */
export const updatePortraitCrop = async (info: BackendInfo, crop: PortraitCrop) =>
  (await request<{ portrait: PortraitInfo }>(info, `${CURRENT}/portrait`, { method: "PATCH", body: crop })).portrait;

export const deletePortrait = (info: BackendInfo) =>
  request<{ portrait: null }>(info, `${CURRENT}/portrait`, { method: "DELETE" });

/** A imagem original do retrato (exige o token, por isso não vai direto num `<img src>`); `null` sem retrato. */
export async function fetchPortraitImage(info: BackendInfo, signal?: AbortSignal): Promise<Blob | null> {
  const init: RequestInit = { headers: authHeaders(info) };
  if (signal) init.signal = signal;
  const response = await fetch(`${baseUrl(info)}${CURRENT}/portrait`, init);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFromResponse(response);
  return response.blob();
}

/** Mensagens claras para os erros do retrato. */
export function portraitErrorMessage(error: unknown): string {
  const code = error instanceof BackendError ? error.code : undefined;
  switch (code) {
    case "formato_invalido":
      return "Este arquivo não é uma imagem PNG, JPEG ou WebP. Escolha outra imagem.";
    case "imagem_grande_demais":
      return "A imagem passa de 20 MB. Escolha uma imagem menor.";
    case "enquadramento_invalido":
      return "O enquadramento não é válido. Ajuste o recorte e tente de novo.";
    case "retrato_ausente":
      return "O retrato não foi encontrado. Escolha uma imagem de novo.";
    default:
      return error instanceof Error && error.message ? error.message : "Não foi possível salvar o retrato.";
  }
}
