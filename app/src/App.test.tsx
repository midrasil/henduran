import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { controlledSse, jsonResponse, sse, sseResponse } from "./test/fakeFetch";
import { createFakeGameApi, summary, type FakeGameOptions } from "./test/fakeGameApi";

const { getBackendInfo, canExitApp, exitApp } = vi.hoisted(() => ({
  getBackendInfo: vi.fn(),
  canExitApp: vi.fn(() => false),
  exitApp: vi.fn(async () => undefined),
}));

vi.mock("./api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/backend")>();
  return { ...actual, getBackendInfo, canExitApp, exitApp };
});

const info = { port: 5000, token: "t" };
const healthOk = { status: "ok", provider: { name: "fake", ready: true } };

type Route = (url: string, init: RequestInit) => Response | Promise<Response>;

const engineStatus = (patch: Record<string, unknown> = {}) => ({
  state: "stopped",
  message: "",
  progress: 0,
  installed: false,
  version: null,
  variant: null,
  verified: null,
  active_model: null,
  active_model_name: null,
  log: "",
  provider: "fake",
  ...patch,
});

const ONE_JOURNEY: FakeGameOptions = { journeys: [summary()], lastJourneyId: summary().id };

function stubFetch(
  routes: { stream?: Route; cancel?: Route; health?: Route; engine?: Route; other?: Route },
  game: FakeGameOptions = ONE_JOURNEY,
) {
  const api = createFakeGameApi(game);
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/health")) return routes.health ? routes.health(url, init) : jsonResponse(healthOk);
    if (url.endsWith("/engine/status")) return routes.engine ? routes.engine(url, init) : jsonResponse(engineStatus());
    if (url.endsWith("/chat/stream") && routes.stream) return routes.stream(url, init);
    if (url.includes("/chat/") && url.includes("/cancel") && routes.cancel) return routes.cancel(url, init);
    const handled = api.handle(url, init);
    if (handled) return handled;
    if (routes.other) return routes.other(url, init);
    throw new Error(`rota inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return Object.assign(fetchMock, { api });
}

/** Espera a consulta a /engine/status ser respondida e a tela se atualizar. */
async function waitForEngineStatus(fetchMock: ReturnType<typeof stubFetch>) {
  await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/engine/status"))).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 20));
}

async function renderConnected() {
  render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
  await screen.findByText("Conectado");
}

/** Abre o app, continua a última Jornada e espera a aba Chat. */
async function renderInJourney() {
  const user = userEvent.setup();
  await renderConnected();
  const button = await screen.findByRole("button", { name: "Continuar Jornada" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await screen.findByRole("tab", { name: "Chat" });
  return user;
}

const modelsRoutes: Route = (url) => {
  if (url.endsWith("/hardware")) return jsonResponse({ gpus: [], ram_bytes: 0, cpu: "", os: "Windows" });
  if (url.endsWith("/models")) return jsonResponse({ models: [], models_dir: "C:\\m", active: null });
  if (url.endsWith("/models/folders")) return jsonResponse({ folders: [] });
  if (url.endsWith("/hub/downloads")) return jsonResponse({ downloads: [] });
  throw new Error(`rota inesperada: ${url}`);
};

beforeEach(() => {
  getBackendInfo.mockReset();
  getBackendInfo.mockResolvedValue(info);
  canExitApp.mockReset();
  canExitApp.mockReturnValue(false);
  exitApp.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("mostra Iniciando serviço… e depois Conectado", async () => {
    stubFetch({});
    render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Iniciando serviço…");
    expect(screen.getByRole("button", { name: "Nova Jornada" })).toBeDisabled();
    await screen.findByText("Conectado");
    expect(screen.getByRole("button", { name: "Nova Jornada" })).toBeEnabled();
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
    const user = await renderInJourney();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(screen.getByLabelText("Mensagem para o Narrador"), "Olá");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const log = screen.getByRole("log", { name: "Conversa" });
    // A conversa não é anunciada palavra por palavra; uma região à parte anuncia início e fim.
    expect(log).toHaveAttribute("aria-live", "off");
    await waitFor(() => expect(screen.getByTestId("chat-live")).toHaveTextContent("O Narrador está respondendo…"));
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
    await waitFor(() => expect(screen.getByTestId("chat-live")).toHaveTextContent("Narrador: Bem-vindo, viajante."));
  });

  it("envia o histórico da conversa nas mensagens seguintes", async () => {
    const bodies: unknown[] = [];
    stubFetch({
      stream: (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return sseResponse([sse("start", { id: "g" }), sse("token", { text: "Resposta" }), sse("done", { reason: "completed" })]);
      },
    });
    const user = await renderInJourney();
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
    const user = await renderInJourney();
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
    const user = await renderInJourney();
    await user.type(screen.getByLabelText("Mensagem para o Narrador"), "Oi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro: Falha ao gerar a resposta do Narrador.");
    expect(screen.getByText("Resposta não concluída.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });
});

describe("App — abas e aviso do motor", () => {
  it("tem as abas Chat, Ficha, Mundo e Objetivos navegáveis pelo teclado", async () => {
    stubFetch({});
    const user = await renderInJourney();
    const chatTab = screen.getByRole("tab", { name: "Chat" });
    expect(chatTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Chat" })).toBeVisible();

    chatTab.focus();
    await user.keyboard("{ArrowRight}");
    const sheetTab = screen.getByRole("tab", { name: "Ficha" });
    expect(sheetTab).toHaveAttribute("aria-selected", "true");
    expect(sheetTab).toHaveFocus();
    expect(await screen.findByRole("heading", { name: "Ficha de Ilsa Corvalho" })).toBeInTheDocument();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Objetivos" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(chatTab).toHaveAttribute("aria-selected", "true");
  });

  it("não mostra aviso com o provedor falso", async () => {
    const fetchMock = stubFetch({});
    await renderInJourney();
    await waitForEngineStatus(fetchMock);
    expect(screen.queryByText(/tela Modelos/)).not.toBeInTheDocument();
  });

  it("mostra aviso com atalho para Modelos quando o motor local não está pronto", async () => {
    stubFetch({
      engine: () => jsonResponse(engineStatus({ provider: "local", installed: false })),
      other: modelsRoutes,
    });
    const user = await renderInJourney();
    expect(await screen.findByText("O motor de IA ainda não foi baixado. Baixe-o na tela Modelos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ir para Modelos" }));
    expect(await screen.findByRole("heading", { name: "Modelos" })).toBeInTheDocument();
    // De Modelos, volta para a Jornada aberta.
    await user.click(screen.getByRole("button", { name: "Voltar à Jornada" }));
    expect(await screen.findByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  });

  it("aviso some quando o motor está pronto", async () => {
    const fetchMock = stubFetch({ engine: () => jsonResponse(engineStatus({ provider: "local", installed: true, state: "ready", active_model: "m.gguf" })) });
    await renderInJourney();
    await waitForEngineStatus(fetchMock);
    expect(screen.queryByRole("button", { name: "Ir para Modelos" })).not.toBeInTheDocument();
  });

  it.each([
    ["no_model", "Nenhum modelo de IA escolhido. Abra a tela Modelos e escolha um modelo."],
    ["engine_not_installed", "O motor de IA ainda não foi baixado. Abra a tela Modelos para baixá-lo."],
    ["engine_not_ready", "O motor de IA não está pronto. Abra a tela Modelos e carregue um modelo."],
  ])("trata o código %s do SSE com mensagem clara e reconsulta o motor", async (code, message) => {
    let engineCalls = 0;
    const fetchMock = stubFetch({
      engine: () => {
        engineCalls++;
        return jsonResponse(engineStatus({ provider: "local", installed: true, active_model: "m.gguf" }));
      },
      stream: () => sseResponse([sse("start", { id: "g" }), sse("error", { message: "texto do serviço", code })]),
    });
    const user = await renderInJourney();
    await waitFor(() => expect(engineCalls).toBeGreaterThan(0));
    const before = engineCalls;
    await user.type(screen.getByLabelText("Mensagem para o Narrador"), "Oi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(`Erro: ${message}`);
    await waitFor(() => expect(engineCalls).toBeGreaterThan(before));
    expect(fetchMock).toHaveBeenCalled();
  });
});
