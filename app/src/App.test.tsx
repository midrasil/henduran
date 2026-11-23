import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { controlledSse, jsonResponse, sse, sseResponse } from "./test/fakeFetch";

const { getBackendInfo } = vi.hoisted(() => ({ getBackendInfo: vi.fn() }));

vi.mock("./api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/backend")>();
  return { ...actual, getBackendInfo };
});

const info = { port: 5000, token: "t" };
const healthOk = { status: "ok", provider: { name: "fake", ready: true } };

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

function stubFetch(routes: { stream?: Route; cancel?: Route; health?: Route }) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/health")) return routes.health ? routes.health(url, init) : jsonResponse(healthOk);
    if (url.endsWith("/chat/stream") && routes.stream) return routes.stream(url, init);
    if (url.includes("/cancel") && routes.cancel) return routes.cancel(url, init);
    throw new Error(`rota inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderConnected() {
  render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
  await screen.findByText("Conectado");
}

beforeEach(() => {
  getBackendInfo.mockReset();
  getBackendInfo.mockResolvedValue(info);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("mostra Iniciando serviço… e depois Conectado", async () => {
    stubFetch({});
    render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Iniciando serviço…");
    expect(screen.getByLabelText("Mensagem para o Narrador")).toBeDisabled();
    await screen.findByText("Conectado");
    expect(screen.getByLabelText("Mensagem para o Narrador")).toBeEnabled();
  });

  it("mostra erro quando o shell não fornece o serviço", async () => {
    getBackendInfo.mockRejectedValue("serviço Python não iniciou");
    stubFetch({});
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent("Erro: serviço Python não iniciou");
  });

  it("mostra erro quando /health falha", async () => {
    stubFetch({ health: () => new Response("", { status: 401 }) });
    render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Erro: serviço indisponível/));
  });

  it("envia mensagem e exibe a resposta em streaming", async () => {
    let fake: ReturnType<typeof controlledSse> | undefined;
    let sentBody: unknown;
    stubFetch({
      stream: (_url, init) => {
        sentBody = JSON.parse(init.body as string);
        fake = controlledSse(init.signal);
        return fake.response;
      },
    });
    const user = userEvent.setup();
    await renderConnected();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(screen.getByLabelText("Mensagem para o Narrador"), "Olá");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const log = screen.getByRole("log", { name: "Conversa" });
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(within(log).getByText("Olá")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
    expect(sentBody).toEqual({ messages: [{ role: "user", content: "Olá" }] });

    fake?.push(sse("start", { id: "g1" }) + sse("token", { text: "Bem-vindo, " }));
    expect(await within(log).findByText("Bem-vindo,")).toBeInTheDocument();
    fake?.push(sse("token", { text: "viajante." }));
    expect(await within(log).findByText("Bem-vindo, viajante.")).toBeInTheDocument();
    fake?.push(sse("done", { reason: "completed" }));
    fake?.close();

    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Mensagem para o Narrador")).toHaveValue("");
  });

  it("envia o histórico da conversa nas mensagens seguintes", async () => {
    const bodies: unknown[] = [];
    stubFetch({
      stream: (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return sseResponse([sse("start", { id: "g" }), sse("token", { text: "Resposta" }), sse("done", { reason: "completed" })]);
      },
    });
    const user = userEvent.setup();
    await renderConnected();
    const input = screen.getByLabelText("Mensagem para o Narrador");
    await user.type(input, "Primeira{Enter}");
    await screen.findByText("Resposta");
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled());
    await user.type(input, "Segunda{Enter}");
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      messages: [
        { role: "user", content: "Primeira" },
        { role: "assistant", content: "Resposta" },
        { role: "user", content: "Segunda" },
      ],
    });
  });

  it("Cancelar chama o endpoint de cancelamento e interrompe a resposta", async () => {
    let fake: ReturnType<typeof controlledSse> | undefined;
    let streamSignal: AbortSignal | null | undefined;
    const cancelUrls: string[] = [];
    stubFetch({
      stream: (_url, init) => {
        streamSignal = init.signal;
        fake = controlledSse(init.signal);
        return fake.response;
      },
      cancel: (url) => {
        cancelUrls.push(url);
        return jsonResponse({ status: "cancelled" });
      },
    });
    const user = userEvent.setup();
    await renderConnected();
    await user.type(screen.getByLabelText("Mensagem para o Narrador"), "Conte uma história{Enter}");
    fake?.push(sse("start", { id: "abc" }) + sse("token", { text: "Era uma vez" }));
    await screen.findByText("Era uma vez");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(cancelUrls).toEqual(["http://127.0.0.1:5000/chat/abc/cancel"]);
    expect(streamSignal?.aborted).toBe(true);
    expect(await screen.findByText("Resposta interrompida.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra erro quando o serviço envia evento error", async () => {
    stubFetch({
      stream: () => sseResponse([sse("start", { id: "g" }), sse("error", { message: "Falha ao gerar a resposta do Narrador." })]),
    });
    const user = userEvent.setup();
    await renderConnected();
    await user.type(screen.getByLabelText("Mensagem para o Narrador"), "Oi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro: Falha ao gerar a resposta do Narrador.");
    expect(screen.getByText("Resposta não concluída.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });
});
