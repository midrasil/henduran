import { afterEach, describe, expect, it, vi } from "vitest";

import { controlledSse, sse, sseResponse } from "../test/fakeFetch";
import { BackendError } from "./backend";
import { cancelChat, isAbortError, streamChat, StreamError } from "./chatStream";

const info = { port: 4321, token: "segredo" };
const messages = [{ role: "user" as const, content: "Olá" }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamChat", () => {
  it("envia POST autenticado e entrega start, tokens e done", async () => {
    const body = sse("start", { id: "g1" }) + sse("token", { text: "Olá, " }) + sse("token", { text: "viajante" }) + sse("done", { reason: "completed" });
    // Parte o corpo em pedaços de 7 bytes para exercitar eventos partidos.
    const chunks = body.match(/[\s\S]{1,7}/g) ?? [];
    const fetchMock = vi.fn(async () => sseResponse(chunks));
    vi.stubGlobal("fetch", fetchMock);

    const onStart = vi.fn();
    const tokens: string[] = [];
    const result = await streamChat(info, messages, { onStart, onToken: (t) => tokens.push(t) });

    expect(result).toEqual({ reason: "completed" });
    expect(onStart).toHaveBeenCalledWith("g1");
    expect(tokens.join("")).toBe("Olá, viajante");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:4321/chat/stream");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer segredo");
    expect(JSON.parse(init.body as string)).toEqual({ messages });
  });

  it("decodifica UTF-8 partido entre chunks", async () => {
    const bytes = new TextEncoder().encode(sse("token", { text: "ação" }) + sse("done", { reason: "completed" }));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const b of bytes) c.enqueue(new Uint8Array([b]));
        c.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream)));
    const tokens: string[] = [];
    await streamChat(info, messages, { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(["ação"]);
  });

  it("informa cancelamento vindo do serviço", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([sse("start", { id: "g" }), sse("done", { reason: "cancelled" })])));
    await expect(streamChat(info, messages)).resolves.toEqual({ reason: "cancelled" });
  });

  it("rejeita com StreamError no evento error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([sse("start", { id: "g" }), sse("error", { message: "falhou" })])));
    await expect(streamChat(info, messages)).rejects.toEqual(new StreamError("falhou"));
  });

  it("rejeita quando a conexão termina sem done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([sse("start", { id: "g" }), sse("token", { text: "a" })])));
    await expect(streamChat(info, messages)).rejects.toBeInstanceOf(StreamError);
  });

  it("rejeita com BackendError em status HTTP de erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const error = await streamChat(info, messages).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect((error as BackendError).status).toBe(401);
  });

  it("aborta a leitura quando o sinal é acionado", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const fake = controlledSse(init.signal);
        fake.push(sse("start", { id: "g" }));
        return fake.response;
      }),
    );
    const onStart = vi.fn();
    const pending = streamChat(info, messages, { onStart }, controller.signal).catch((e: unknown) => e);
    await vi.waitFor(() => expect(onStart).toHaveBeenCalledWith("g"));
    controller.abort();
    expect(isAbortError(await pending)).toBe(true);
  });
});

describe("cancelChat", () => {
  it("faz POST no endpoint de cancelamento e tolera 404", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(cancelChat(info, "g 1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:4321/chat/g%201/cancel");
    expect(init.method).toBe("POST");
  });

  it("rejeita em outros erros", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(cancelChat(info, "g")).rejects.toBeInstanceOf(BackendError);
  });
});
