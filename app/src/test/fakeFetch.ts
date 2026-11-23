/** Utilitários para simular respostas de `fetch` em streaming nos testes. */

const encoder = new TextEncoder();

/** Resposta SSE que entrega `chunks` em sequência e fecha. */
export function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
    ...init,
  });
}

/**
 * Resposta SSE controlada pelo teste: `push` envia texto, `close` encerra.
 * Se `signal` for abortado, a leitura falha com `AbortError`, como num fetch real.
 */
export function controlledSse(signal?: AbortSignal | null) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  signal?.addEventListener("abort", () => {
    if (closed) return;
    closed = true;
    controller.error(new DOMException("A operação foi abortada.", "AbortError"));
  });
  return {
    response: new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
    push(text: string) {
      if (!closed) controller.enqueue(encoder.encode(text));
    },
    close() {
      if (closed) return;
      closed = true;
      controller.close();
    },
  };
}

export function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
