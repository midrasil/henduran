import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, sse, sseResponse } from "../test/fakeFetch";
import { proposalOf, sceneOf } from "../test/fakeJourneyScreen";
import { BackendError } from "./backend";
import { StreamError } from "./chatStream";
import {
  fetchEvents,
  fetchPortraitImage,
  portraitErrorMessage,
  renameScene,
  streamAcceptProposal,
  streamSend,
  updatePortraitCrop,
  uploadPortrait,
} from "./journeyScreen";

const info = { port: 5000, token: "t" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stub(response: Response | (() => Response)) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => (typeof response === "function" ? response() : response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("streamNarration", () => {
  it("envia a mensagem com o canal e lê token, proposal e done", async () => {
    const proposal = proposalOf(7);
    const fetchMock = stub(
      sseResponse([
        sse("start", { id: "g1" }),
        sse("token", { text: "Isso pede " }),
        sse("token", { text: "uma Cena." }),
        sse("proposal", { proposal }),
        sse("done", { reason: "completed", message: { id: 3 }, proposal }),
      ]),
    );
    const tokens: string[] = [];
    const onProposal = vi.fn();
    const onStart = vi.fn();
    const done = await streamSend(info, "Vou segui-los", "fora_de_cena", { onStart, onToken: (t) => tokens.push(t), onProposal });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:5000/journeys/current/messages");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ content: "Vou segui-los", channel: "fora_de_cena" });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer t");
    expect(onStart).toHaveBeenCalledWith("g1");
    expect(tokens.join("")).toBe("Isso pede uma Cena.");
    expect(onProposal).toHaveBeenCalledWith(proposal);
    expect(done.reason).toBe("completed");
    expect(done.proposal).toEqual(proposal);
  });

  it("repassa proposal_error sem interromper a resposta", async () => {
    stub(
      sseResponse([
        sse("start", { id: "g" }),
        sse("token", { text: "Talvez." }),
        sse("proposal_error", { code: "proposta_invalida", message: "Propostas recusadas." }),
        sse("done", { reason: "completed", message: null, proposal: null }),
      ]),
    );
    const onProposalError = vi.fn();
    const done = await streamSend(info, "x", undefined, { onProposalError });
    expect(onProposalError).toHaveBeenCalledWith("proposta_invalida", "Propostas recusadas.");
    expect(done.reason).toBe("completed");
  });

  it("aceitar a proposta entrega a Cena (evento scene) antes da narração", async () => {
    const scene = sceneOf(4);
    const proposal = proposalOf(7);
    stub(
      sseResponse([
        sse("start", { id: "g" }),
        sse("scene", { scene: { ...scene, id: null, status: "proposta" }, proposal }),
        sse("token", { text: "A neblina." }),
        sse("done", { reason: "completed", mode: "em_cena", scene, current_place: { id: "j-1", name: "Becos", type: "becos", description: "", source: "jornada" } }),
      ]),
    );
    const order: string[] = [];
    const done = await streamAcceptProposal(info, {
      onScene: (s, p) => order.push(`scene:${s.status}:${p?.id}`),
      onToken: (t) => order.push(`token:${t}`),
    });
    expect(order).toEqual(["scene:proposta:7", "token:A neblina."]);
    expect(done.mode).toBe("em_cena");
    expect(done.current_place?.name).toBe("Becos");
  });

  it("cancelado vira reason cancelled", async () => {
    stub(sseResponse([sse("start", { id: "g" }), sse("done", { reason: "cancelled" })]));
    expect((await streamSend(info, "x", "cena")).reason).toBe("cancelled");
  });

  it("evento error vira StreamError com o código", async () => {
    stub(sseResponse([sse("start", { id: "g" }), sse("error", { message: "Sem modelo.", code: "no_model" })]));
    const err = await streamSend(info, "x", "cena").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StreamError);
    expect((err as StreamError).code).toBe("no_model");
  });

  it("409 antes do fluxo vira BackendError (abertura_pendente)", async () => {
    stub(jsonResponse({ detail: { code: "abertura_pendente", message: "Gere a abertura primeiro." } }, 409));
    const err = await streamSend(info, "x", "cena").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackendError);
    expect((err as BackendError).code).toBe("abertura_pendente");
  });

  it("fim do fluxo sem done é erro", async () => {
    stub(sseResponse([sse("start", { id: "g" }), sse("token", { text: "a" })]));
    await expect(streamSend(info, "x", "cena")).rejects.toThrow("A conexão foi encerrada antes do fim da resposta.");
  });
});

describe("rotas JSON da tela da Jornada", () => {
  it("renomeia com PATCH e lê o Log de uma Cena", async () => {
    const fetchMock = stub(() => jsonResponse({ scene: sceneOf(2, { title: "Novo" }), events: [] }));
    await renameScene(info, 2, "Novo");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://127.0.0.1:5000/journeys/current/scenes/2");
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({ title: "Novo" });
    await fetchEvents(info, 2);
    expect(fetchMock.mock.calls[1]![0]).toBe("http://127.0.0.1:5000/journeys/current/events?scene_id=2");
    await fetchEvents(info, null);
    expect(fetchMock.mock.calls[2]![0]).toBe("http://127.0.0.1:5000/journeys/current/events");
  });
});

describe("retrato", () => {
  it("envia a imagem com o enquadramento na query (PUT) e refaz só o enquadramento (PATCH)", async () => {
    const fetchMock = stub(() => jsonResponse({ portrait: { crop: { x: 0.4, y: 0.3, zoom: 2 }, url_path: "/journeys/current/portrait" } }));
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    await uploadPortrait(info, blob, { x: 0.4, y: 0.3, zoom: 2 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:5000/journeys/current/portrait?x=0.4&y=0.3&zoom=2");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(blob);
    await updatePortraitCrop(info, { x: 0.5, y: 0.5, zoom: 1 });
    expect(fetchMock.mock.calls[1]![1]?.method).toBe("PATCH");
  });

  it("busca a imagem com o token como blob; 404 = sem retrato", async () => {
    const fetchMock = stub(() => new Response(new Uint8Array([137, 80]), { status: 200, headers: { "Content-Type": "image/png" } }));
    const blob = await fetchPortraitImage(info);
    expect(blob).not.toBeNull();
    expect((fetchMock.mock.calls[0]![1]?.headers as Record<string, string>).Authorization).toBe("Bearer t");
    stub(jsonResponse({ detail: { code: "retrato_ausente", message: "x" } }, 404));
    expect(await fetchPortraitImage(info)).toBeNull();
  });

  it("explica os erros do retrato em português", () => {
    expect(portraitErrorMessage(new BackendError("x", 422, "formato_invalido"))).toMatch(/não é uma imagem PNG, JPEG ou WebP/);
    expect(portraitErrorMessage(new BackendError("x", 413, "imagem_grande_demais"))).toMatch(/passa de 20 MB/);
  });
});
