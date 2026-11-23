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

// A tela da Jornada inteira no jsdom é lenta em máquinas carregadas.
vi.setConfig({ testTimeout: 20000 });

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

function stubFetch(routes: { cancel?: Route; health?: Route; engine?: Route; other?: Route }, game: FakeGameOptions = ONE_JOURNEY) {
  const api = createFakeGameApi(game);
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/health")) return routes.health ? routes.health(url, init) : jsonResponse(healthOk);
    if (url.endsWith("/engine/status")) return routes.engine ? routes.engine(url, init) : jsonResponse(engineStatus());
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

/** Abre o app, continua a última Jornada e espera a página da Cena. */
async function renderInJourney() {
  const user = userEvent.setup();
  await renderConnected();
  const button = await screen.findByRole("button", { name: "Continuar Jornada" });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await screen.findByRole("log", { name: "Conversa da Cena" });
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
});

describe("App — chat da Jornada", () => {
  it("envia mensagem na Cena e exibe a resposta em streaming, sem anunciar cada palavra", async () => {
    let fake: ReturnType<typeof controlledSse> | undefined;
    let sentBody: unknown;
    const fetchMock = stubFetch(
      {},
      {
        ...ONE_JOURNEY,
        narrate: (path, body, init) => {
          if (!path.endsWith("/messages")) return undefined;
          sentBody = body;
          fake = controlledSse(init.signal);
          return fake.response;
        },
      },
    );
    const user = await renderInJourney();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await user.type(screen.getByLabelText("Mensagem para o Narrador da Cena"), "Olá");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const log = screen.getByRole("log", { name: "Conversa da Cena" });
    expect(log).toHaveAttribute("aria-live", "off");
    await waitFor(() => expect(screen.getByTestId("chat-live")).toHaveTextContent("O Narrador está respondendo…"));
    expect(within(log).getByText("Olá")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parar" })).toBeVisible();
    expect(sentBody).toEqual({ content: "Olá", channel: "cena" });

    fake?.push(sse("start", { id: "g1" }) + sse("token", { text: "Bem-vindo, " }));
    expect(await within(log).findByText("Bem-vindo,")).toBeInTheDocument();
    fake?.push(sse("token", { text: "viajante." }));
    expect(await within(log).findByText("Bem-vindo, viajante.")).toBeInTheDocument();
    // O serviço grava as duas mensagens antes do done.
    const screenState = fetchMock.api.state.screen;
    screenState.messages.push(
      { id: 50, channel: "cena", scene_id: 1, role: "jogador", content: "Olá", status: "concluida", created_at: "x" },
      { id: 51, channel: "cena", scene_id: 1, role: "narrador", content: "Bem-vindo, viajante.", status: "concluida", created_at: "x" },
    );
    fake?.push(sse("done", { reason: "completed", message: null, proposal: null }));
    fake?.close();

    await waitFor(() => expect(screen.queryByRole("button", { name: "Parar" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Mensagem para o Narrador da Cena")).toHaveValue("");
    await waitFor(() => expect(screen.getByTestId("chat-live")).toHaveTextContent("Narrador: Bem-vindo, viajante."));
    expect(within(log).getByText("Bem-vindo, viajante.")).toBeInTheDocument();
  });

  it("Parar chama o endpoint de cancelamento e a resposta fica interrompida", async () => {
    let fake: ReturnType<typeof controlledSse> | undefined;
    let streamSignal: AbortSignal | null | undefined;
    const cancelUrls: string[] = [];
    const fetchMock = stubFetch(
      {
        cancel: (url) => {
          cancelUrls.push(url);
          return jsonResponse({ status: "cancelled" });
        },
      },
      {
        ...ONE_JOURNEY,
        narrate: (path, _body, init) => {
          if (!path.endsWith("/messages")) return undefined;
          streamSignal = init.signal;
          fake = controlledSse(init.signal);
          return fake.response;
        },
      },
    );
    const user = await renderInJourney();
    await user.type(screen.getByLabelText("Mensagem para o Narrador da Cena"), "Conte{Enter}");
    fake?.push(sse("start", { id: "abc" }) + sse("token", { text: "Era uma vez" }));
    await screen.findByText("Era uma vez");
    fetchMock.api.state.screen.messages.push(
      { id: 60, channel: "cena", scene_id: 1, role: "jogador", content: "Conte", status: "concluida", created_at: "x" },
      { id: 61, channel: "cena", scene_id: 1, role: "narrador", content: "Era uma vez", status: "cancelada", created_at: "x" },
    );

    await user.click(screen.getByRole("button", { name: "Parar" }));

    expect(cancelUrls).toEqual(["http://127.0.0.1:5000/chat/abc/cancel"]);
    expect(streamSignal?.aborted).toBe(true);
    expect(await screen.findByText("Resposta interrompida.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Parar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("chat-live")).toHaveTextContent("Resposta interrompida. Narrador: Era uma vez"));
  });

  it("mostra erro quando o serviço envia evento error", async () => {
    stubFetch(
      {},
      {
        ...ONE_JOURNEY,
        narrate: (path) =>
          path.endsWith("/messages")
            ? sseResponse([sse("start", { id: "g" }), sse("error", { message: "Falha ao gerar a resposta do Narrador.", code: "generation_failed" })])
            : undefined,
      },
    );
    const user = await renderInJourney();
    await user.type(screen.getByLabelText("Mensagem para o Narrador da Cena"), "Oi{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro: Falha ao gerar a resposta do Narrador.");
    expect(screen.queryByRole("button", { name: "Parar" })).not.toBeInTheDocument();
  });
});

describe("App — tela da Jornada e modelo", () => {
  it("não tem barra de abas: barra com céu, Arcos, centro e Ficha", async () => {
    stubFetch({});
    await renderInJourney();
    expect(screen.getByRole("heading", { level: 1, name: "O Selo de Elmora" })).toHaveFocus();
    expect(document.querySelector(".jbar .sky")).toHaveAttribute("data-period", "noite");
    expect(screen.getByRole("navigation", { name: "Arcos e Cenas" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Ficha resumida" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Mundo" })).not.toBeInTheDocument();
    // Período e data do calendário do Mundo na barra.
    expect(document.querySelector(".jbar__period")).toHaveTextContent(/Noite.*12 de Alvorim/);
  });

  it("com o provedor falso, o indicador diz Modelo pronto", async () => {
    const fetchMock = stubFetch({});
    await renderInJourney();
    await waitForEngineStatus(fetchMock);
    expect(screen.getByRole("button", { name: /Modelo pronto/ })).toBeInTheDocument();
  });

  it("sem modelo, o indicador leva à tela Modelos e de lá volta à Jornada", async () => {
    stubFetch({
      engine: () => jsonResponse(engineStatus({ provider: "local", installed: false })),
      other: modelsRoutes,
    });
    const user = await renderInJourney();
    const model = await screen.findByRole("button", { name: /Sem modelo/ });
    await user.click(model);
    expect(await screen.findByRole("heading", { name: "Modelos" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar à Jornada" }));
    expect(await screen.findByRole("heading", { level: 1, name: "O Selo de Elmora" })).toBeInTheDocument();
  });

  it.each([
    ["no_model", "Nenhum modelo de IA escolhido. Abra a tela Modelos e escolha um modelo."],
    ["engine_not_installed", "O motor de IA ainda não foi baixado. Abra a tela Modelos para baixá-lo."],
    ["engine_not_ready", "O motor de IA não está pronto. Abra a tela Modelos e carregue um modelo."],
  ])("trata o código %s do SSE com mensagem clara e reconsulta o motor", async (code, message) => {
    let engineCalls = 0;
    stubFetch(
      {
        engine: () => {
          engineCalls++;
          return jsonResponse(engineStatus({ provider: "local", installed: true, active_model: "m.gguf", state: "ready" }));
        },
      },
      {
        ...ONE_JOURNEY,
        narrate: (path) => (path.endsWith("/messages") ? sseResponse([sse("start", { id: "g" }), sse("error", { message: "texto do serviço", code })]) : undefined),
      },
    );
    const user = await renderInJourney();
    await waitFor(() => expect(engineCalls).toBeGreaterThan(0));
    const before = engineCalls;
    await user.type(screen.getByLabelText("Mensagem para o Narrador da Cena"), "Oi{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Erro: ${message}`);
    expect(within(alert).getByRole("button", { name: "Configurar modelo" })).toBeInTheDocument();
    await waitFor(() => expect(engineCalls).toBeGreaterThan(before));
  });
});
