import { authHeaders, BackendError, baseUrl, type BackendInfo } from "./backend";
import { SseParser, type SseEvent } from "./sse";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessagePayload {
  role: ChatRole;
  content: string;
}

export type DoneReason = "completed" | "cancelled";

export interface StreamHandlers {
  onStart?: (generationId: string) => void;
  onToken?: (text: string) => void;
}

export interface StreamResult {
  reason: DoneReason;
}

/** Erro informado pelo próprio serviço num evento `error`. */
export class StreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

function parseData(event: SseEvent): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(event.data);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    throw new StreamError("Resposta inválida do serviço.");
  }
}

/**
 * Envia a conversa e lê a resposta do Narrador em streaming (SSE sobre POST).
 *
 * `EventSource` só faz GET, por isso o corpo do `fetch` é lido como stream.
 * Abortar `signal` fecha a conexão, o que também cancela a geração no serviço.
 */
export async function streamChat(
  info: BackendInfo,
  messages: ChatMessagePayload[],
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<StreamResult> {
  const init: RequestInit = {
    method: "POST",
    headers: {
      ...authHeaders(info),
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages }),
  };
  if (signal) init.signal = signal;

  const response = await fetch(`${baseUrl(info)}/chat/stream`, init);
  if (!response.ok) {
    throw new BackendError(`o serviço respondeu ${response.status}`, response.status);
  }
  if (!response.body) {
    throw new BackendError("resposta sem corpo");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = new SseParser();

  const handle = (event: SseEvent): StreamResult | null => {
    const data = parseData(event);
    switch (event.event) {
      case "start":
        if (typeof data.id === "string") handlers.onStart?.(data.id);
        return null;
      case "token":
        if (typeof data.text === "string") handlers.onToken?.(data.text);
        return null;
      case "done":
        return { reason: data.reason === "cancelled" ? "cancelled" : "completed" };
      case "error":
        throw new StreamError(
          typeof data.message === "string" ? data.message : "Erro desconhecido do serviço.",
        );
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

/** Pede ao serviço que interrompa a geração `generationId`. */
export async function cancelChat(info: BackendInfo, generationId: string): Promise<void> {
  const response = await fetch(
    `${baseUrl(info)}/chat/${encodeURIComponent(generationId)}/cancel`,
    { method: "POST", headers: authHeaders(info) },
  );
  // 404: a geração já terminou; não é um erro para quem cancela.
  if (!response.ok && response.status !== 404) {
    throw new BackendError(`o serviço respondeu ${response.status}`, response.status);
  }
}
