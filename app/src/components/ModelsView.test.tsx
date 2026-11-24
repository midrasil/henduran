import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EngineStatus, VramEstimate } from "../api/engine";
import { useEngineStatus } from "../hooks/useEngineStatus";
import { jsonResponse } from "../test/fakeFetch";
import { ModelsView } from "./ModelsView";

const info = { port: 5000, token: "t" };
const GB = 2 ** 30;

const HARDWARE = {
  gpus: [{ name: "Radeon Teste", memory_bytes: 8 * GB }],
  ram_bytes: 16 * GB,
  cpu: "Ryzen Teste",
  os: "Windows 11",
};

const OPTIONS = { context_size: 4096, gpu_layers: "auto" as const };

const MODELS = {
  models_dir: "C:\\Users\\x\\AppData\\Local\\Henduran\\models",
  active: null as string | null,
  models: [
    { id: "a.gguf", name: "Pequeno-Q4_K_M.gguf", size_bytes: 400 * 2 ** 20, quant: "Q4_K_M", parts: 1, complete: true, fit: "gpu", active: false, source: "app", removable: true, hidden: false, options: OPTIONS },
    { id: "b.gguf", name: "Médio-Q8_0.gguf", size_bytes: 9 * GB, quant: "Q8_0", parts: 1, complete: true, fit: "cpu_lento", active: false, source: "app", removable: true, hidden: false, options: OPTIONS },
    { id: "c.gguf", name: "Enorme-F16.gguf", size_bytes: 40 * GB, quant: "F16", parts: 1, complete: true, fit: "pesado_demais", active: false, source: "app", removable: true, hidden: false, options: OPTIONS },
  ],
};

const SUGGESTIONS = {
  suggestions: [
    { name: "Stheno 8B (L3-8B-Stheno-v3.2)", quant: "Q4_K_M", search: "Stheno-v3.2", why: "A escolha recomendada para placas de 8 GB.", gpu: true, min_vram_bytes: 7.5 * GB, license: null, source: "Caliope" },
  ],
  search_terms: ["Cydonia-24B", "Stheno-v3.2"],
};

function estimate(patch: Partial<VramEstimate> = {}): VramEstimate {
  return {
    id: "a.gguf",
    context_size: 4096,
    gpu_layers: "auto",
    total_layers: 29,
    layers_on_gpu: 29,
    weights_bytes: 4 * GB,
    kv_bytes: GB / 2,
    vram_bytes: 4.5 * GB,
    vram_total_bytes: 8 * GB,
    known: true,
    slots: 2,
    variant: "vulkan",
    ...patch,
  };
}

function status(patch: Partial<EngineStatus> = {}): EngineStatus {
  return {
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
    provider: "local",
    ...patch,
  };
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** `statuses` é consumida a cada GET /engine/status; o último valor se repete. */
function stubFetch({
  statuses = [status()],
  models = MODELS,
  extra,
}: { statuses?: EngineStatus[]; models?: typeof MODELS; extra?: Handler } = {}) {
  const queue = [...statuses];
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
    const path = url.replace("http://127.0.0.1:5000", "");
    if (extra) {
      const r = await extra(path, init);
      if (r.status !== 599) return r;
    }
    if (path === "/engine/status") return jsonResponse(queue.length > 1 ? queue.shift() : queue[0]);
    if (path === "/hardware") return jsonResponse(HARDWARE);
    if (path === "/models") return jsonResponse(models);
    if (path === "/models/suggestions") return jsonResponse(SUGGESTIONS);
    if (path.startsWith("/models/estimate")) return jsonResponse(estimate());
    if (path === "/hub/downloads") return jsonResponse({ downloads: [] });
    if (path === "/models/folders") return jsonResponse({ folders: [{ path: MODELS.models_dir, kind: "app", exists: true }] });
    throw new Error(`rota inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const pass = () => new Response(null, { status: 599 });

function Harness() {
  const engine = useEngineStatus(info, 10);
  return (
    <ModelsView
      info={info}
      engine={engine.status}
      engineError={engine.error}
      onEngineChange={engine.setStatus}
      refreshEngine={engine.refresh}
    />
  );
}

const engineBox = () => screen.getByRole("region", { name: "Motor de IA" });
const narratorBox = () => screen.getByRole("region", { name: "Narrador" });
const modelCard = (name: string) =>
  screen.getAllByRole("listitem").find((li) => li.querySelector(".list-card__title")?.textContent === name)!;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ModelsView — cabeçalho e abas", () => {
  it("três quadros de estado sem título visível e três abas (sem Skills)", async () => {
    stubFetch();
    render(<Harness />);
    const pc = await screen.findByRole("region", { name: "Este PC" });
    expect(await within(pc).findByText("Radeon Teste")).toBeInTheDocument();
    expect(pc).toHaveTextContent("8 GB de memória de vídeo · 16 GB de RAM");
    expect(pc).toHaveTextContent("Ryzen Teste · Windows 11");
    expect(engineBox()).toBeInTheDocument();
    expect(narratorBox()).toHaveTextContent("Nenhum modelo");
    // O título "Modelos" existe só para leitores de tela (e para o foco ao trocar de tela).
    expect(screen.getByRole("heading", { level: 2, name: "Modelos" })).toHaveClass("visually-hidden");
    const tabs = within(screen.getByRole("tablist", { name: "Partes da tela Modelos" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Modelos", "Procurar neste PC", "Downloads"]);
    expect(screen.queryByRole("tab", { name: /Skills/ })).not.toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("abas trocam com as setas do teclado", async () => {
    stubFetch();
    const user = userEvent.setup();
    render(<Harness />);
    const first = await screen.findByRole("tab", { name: "Modelos" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Procurar neste PC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Procurar neste PC" })).toHaveFocus();
    expect(await screen.findByRole("heading", { name: "Pastas de modelos" })).toBeVisible();
  });
});

describe("ModelsView — motor de IA", () => {
  it("sem motor: Baixar o motor mostra o tamanho e baixa a variante escolhida após confirmar", async () => {
    const calls = stubFetch({
      extra: (path) => {
        if (path.startsWith("/engine/release")) {
          return jsonResponse({ tag: "b12635", variant: "cpu", name: "llama-b12635-bin-win-cpu-x64.zip", url: "u", size: 25 * 2 ** 20, digest: "ab", verifiable: true });
        }
        if (path === "/engine/install") return jsonResponse(status({ state: "downloading", message: "Baixando…" }), 202);
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(engineBox()).toHaveTextContent("Motor não instalado"));
    await user.click(within(engineBox()).getByRole("button", { name: "Baixar o motor" }));
    const dialog = screen.getByRole("dialog", { name: "Baixar o motor de IA" });
    expect(within(dialog).getByRole("radio", { name: /Vulkan/ })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: /CPU/ }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    expect(await within(dialog).findByText(/llama-b12635-bin-win-cpu-x64\.zip \(25 MB\), versão b12635/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/engine/release?variant=cpu"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/engine/install"))).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar download" }));
    expect(calls.find((c) => c.url.endsWith("/engine/install"))?.body).toEqual({ variant: "cpu", allow_unverified: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sem digest: exibe aviso e exige segundo consentimento", async () => {
    const calls = stubFetch({
      extra: (path) => {
        if (path.startsWith("/engine/release")) {
          return jsonResponse({ tag: "b1", variant: "vulkan", name: "llama-b1-bin-win-vulkan-x64.zip", url: "u", size: 38 * 2 ** 20, digest: null, verifiable: false });
        }
        if (path === "/engine/install") return jsonResponse(status({ state: "downloading" }), 202);
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await within(await screen.findByRole("region", { name: "Motor de IA" })).findByRole("button", { name: "Baixar o motor" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não publicou o SHA-256");
    const confirmButton = screen.getByRole("button", { name: "Confirmar download" });
    expect(confirmButton).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Entendo o risco e quero baixar sem verificação" }));
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    expect(calls.find((c) => c.url.endsWith("/engine/install"))?.body).toEqual({ variant: "vulkan", allow_unverified: true });
  });

  it("baixando: mostra progresso e consulta o estado até terminar", async () => {
    stubFetch({
      statuses: [
        status({ state: "downloading", message: "Baixando o motor de IA… 10 / 38 MB", progress: 0.25 }),
        status({ state: "downloading", message: "Baixando o motor de IA… 30 / 38 MB", progress: 0.8 }),
        status({ state: "stopped", message: "Motor de IA b12635 (vulkan) instalado.", installed: true, version: "b12635", variant: "vulkan", verified: true }),
      ],
    });
    render(<Harness />);
    expect(await screen.findByRole("progressbar", { name: "Progresso do download do motor" })).toBeInTheDocument();
    expect(within(engineBox()).getByRole("status")).toHaveTextContent(/Baixando o motor… \d+%/);
    await waitFor(() => expect(engineBox()).toHaveTextContent("Motor parado"));
    expect(engineBox()).toHaveTextContent("Vulkan (usa a placa de vídeo) · versão b12635");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("erro: Ver o log mostra o final do log e Tentar de novo reinicia", async () => {
    const calls = stubFetch({
      statuses: [status({ installed: true, state: "error", active_model: "a.gguf", message: "O motor parou enquanto carregava o modelo.", log: "ggml_vulkan: ErrorOutOfDeviceMemory" })],
      extra: (path) => (path === "/engine/start" ? jsonResponse(status({ installed: true, state: "starting", active_model: "a.gguf" }), 202) : pass()),
    });
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(engineBox()).toHaveTextContent("O motor teve um erro"));
    expect(engineBox()).toHaveTextContent("O motor parou enquanto carregava o modelo.");
    await user.click(within(engineBox()).getByRole("button", { name: "Ver o log" }));
    const dialog = screen.getByRole("dialog", { name: "Log do motor de IA" });
    expect(within(dialog).getByLabelText("Final do log do motor")).toHaveTextContent("ErrorOutOfDeviceMemory");
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    await user.click(within(engineBox()).getByRole("button", { name: "Tentar de novo" }));
    expect(calls.some((c) => c.url.endsWith("/engine/start") && c.method === "POST")).toBe(true);
  });
});

describe("ModelsView — Meus modelos", () => {
  it("sem modelos: tela inicial com os dois passos, sugestões e atalho para Procurar neste PC", async () => {
    stubFetch({ statuses: [status({ installed: true, version: "b1", variant: "vulkan" })], models: { ...MODELS, models: [] } });
    const user = userEvent.setup();
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "Vamos dar uma voz ao Narrador" })).toBeInTheDocument();
    expect(screen.getByText("1. Motor de IA").parentElement).toHaveTextContent("Instalado.");
    const sugs = await screen.findByRole("list", { name: "Sugestões para este PC" });
    expect(sugs).toHaveTextContent("Stheno 8B (L3-8B-Stheno-v3.2)");
    expect(sugs).toHaveTextContent("Licença: a lista não informa; confira no repositório antes de baixar.");
    expect(screen.getByText(/São só sugestões: nada é escolhido nem baixado sozinho/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Já tenho modelos neste PC" }));
    expect(screen.getByRole("tab", { name: "Procurar neste PC" })).toHaveAttribute("aria-selected", "true");
  });

  it("lista com quantização, nota de qualidade, tamanho e compatibilidade; pesado demais não carrega", async () => {
    stubFetch({ statuses: [status({ installed: true })] });
    render(<Harness />);
    await screen.findByRole("heading", { name: "Meus modelos (3)" });
    const small = modelCard("Pequeno-Q4_K_M");
    expect(small).toHaveTextContent("Q4_K_M · 400 MB");
    expect(small).toHaveTextContent("Q4_K_M: Bom equilíbrio. A escolha mais comum.");
    expect(small).toHaveTextContent("Cabe na placa");
    expect(modelCard("Médio-Q8_0")).toHaveTextContent("Roda na CPU, lento");
    expect(modelCard("Médio-Q8_0")).toHaveTextContent("Q8_0: Quase sem perda, o maior.");
    expect(modelCard("Enorme-F16")).toHaveTextContent("Pesado demais para este PC");
    const load = within(small).getByRole("button", { name: "Carregar…" });
    expect(load).toBeEnabled();
    expect(load).toHaveAccessibleDescription("Pequeno-Q4_K_M");
    expect(within(modelCard("Enorme-F16")).getByRole("button", { name: "Carregar…" })).toBeDisabled();
    expect(within(small).getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
    expect(within(small).getByRole("button", { name: "Apagar do disco" })).toBeInTheDocument();
  });

  it("sem motor instalado, Carregar… fica desativado com explicação", async () => {
    stubFetch({ statuses: [status({ installed: false })] });
    render(<Harness />);
    await screen.findByRole("heading", { name: "Meus modelos (3)" });
    for (const b of screen.getAllByRole("button", { name: "Carregar…" })) expect(b).toBeDisabled();
    expect(screen.getByText("Baixe o motor de IA antes de carregar um modelo.")).toBeInTheDocument();
  });

  it("a busca filtra os seus modelos ignorando acentos, hífens e caixa; filtros com contadores", async () => {
    stubFetch({ statuses: [status({ installed: true })] });
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("heading", { name: "Meus modelos (3)" });
    const filters = screen.getByRole("group", { name: "Filtro:" });
    expect(within(filters).getByRole("button", { name: "Todos 4" })).toHaveAttribute("aria-pressed", "true");
    expect(within(filters).getByRole("button", { name: "Meus modelos 3" })).toHaveAttribute("aria-pressed", "false");
    expect(within(filters).getByRole("button", { name: "Para baixar 1" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Buscar modelo" }), "MEDIO q8");
    expect(await screen.findByRole("heading", { name: "Meus modelos (1)" })).toBeInTheDocument();
    expect(modelCard("Médio-Q8_0")).toBeDefined();
    await user.click(within(filters).getByRole("button", { name: /Para baixar/ }));
    expect(screen.queryByRole("heading", { name: /Meus modelos/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Para baixar: sugestões para este PC" })).toBeInTheDocument();
    await user.click(within(filters).getByRole("button", { name: /Meus modelos/ }));
    expect(screen.queryByRole("heading", { name: /Para baixar/ })).not.toBeInTheDocument();
  });

  it("Ocultar manda o modelo para a seção Ocultos (nada é apagado)", async () => {
    let hidden = false;
    const calls = stubFetch({
      statuses: [status({ installed: true })],
      extra: (path) => {
        if (path === "/models/hidden") {
          hidden = true;
          return jsonResponse({ id: "a.gguf", hidden: true });
        }
        if (path === "/models") {
          return jsonResponse({ ...MODELS, models: MODELS.models.map((m) => (m.id === "a.gguf" ? { ...m, hidden } : m)) });
        }
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("heading", { name: "Meus modelos (3)" });
    await user.click(within(modelCard("Pequeno-Q4_K_M")).getByRole("button", { name: "Ocultar" }));
    expect(await screen.findByRole("heading", { name: "Meus modelos (2)" })).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith("/models/hidden"))?.body).toEqual({ id: "a.gguf", hidden: true });
    const summary = screen.getByText("Ocultos (1)");
    await user.click(summary);
    expect(within(modelCard("Pequeno-Q4_K_M")).getByRole("button", { name: "Mostrar na lista" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});

describe("ModelsView — Carregar…", () => {
  it("diálogo com contexto, camadas e memória estimada; carrega com os ajustes e depois descarrega", async () => {
    let selected = false;
    const calls = stubFetch({
      statuses: [
        status({ installed: true, variant: "vulkan", version: "b1" }),
        status({ installed: true, state: "starting", active_model: "a.gguf" }),
        status({ installed: true, state: "ready", active_model: "a.gguf" }),
      ],
      extra: (path) => {
        if (path.startsWith("/models/estimate")) {
          const params = new URLSearchParams(path.split("?")[1]);
          const ctx = Number(params.get("context_size"));
          const layers = params.get("gpu_layers");
          return jsonResponse(estimate({ context_size: ctx, gpu_layers: layers === "auto" ? "auto" : Number(layers), layers_on_gpu: layers === "auto" ? 29 : Number(layers), vram_bytes: ctx === 8192 ? 5 * GB : 4.5 * GB }));
        }
        if (path === "/models/select") {
          selected = true;
          return jsonResponse({ active: "a.gguf", name: "Pequeno-Q4_K_M.gguf" });
        }
        if (path === "/engine/start") return jsonResponse(status({ installed: true, state: "starting", active_model: "a.gguf" }), 202);
        if (path === "/engine/stop") return jsonResponse(status({ installed: true }));
        if (path === "/models" && selected) return jsonResponse({ ...MODELS, active: "a.gguf" });
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("heading", { name: "Meus modelos (3)" });
    await user.click(within(modelCard("Pequeno-Q4_K_M")).getByRole("button", { name: "Carregar…" }));
    const dialog = screen.getByRole("dialog", { name: "Carregar Pequeno-Q4_K_M" });
    expect(await within(dialog).findByText(/Memória de vídeo estimada:/)).toHaveTextContent("Memória de vídeo estimada: 4,5 GB de 8,0 GB.");
    expect(within(dialog).getByRole("checkbox", { name: /Camadas na placa de vídeo: automático \(29 de 29\)/ })).toBeChecked();

    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Tamanho do contexto" }), "8192");
    await waitFor(() => expect(within(dialog).getByText(/Memória de vídeo estimada:/)).toHaveTextContent("5,0 GB"));
    expect(calls.some((c) => c.url.includes("/models/estimate?id=a.gguf&context_size=8192&gpu_layers=auto"))).toBe(true);

    await user.click(within(dialog).getByRole("checkbox", { name: /automático/ }));
    const slider = within(dialog).getByRole("slider", { name: "Camadas na placa de vídeo: 29 de 29" });
    expect(slider).toHaveAttribute("max", "29");
    await user.click(within(dialog).getByRole("button", { name: "Carregar" }));
    expect(calls.find((c) => c.url.endsWith("/models/select"))?.body).toEqual({ id: "a.gguf", context_size: 8192, gpu_layers: 29 });
    expect(calls.some((c) => c.url.endsWith("/engine/start") && c.method === "POST")).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await waitFor(() => expect(narratorBox()).toHaveTextContent("Pequeno-Q4_K_M"));
    await waitFor(() => expect(narratorBox()).toHaveTextContent("carregado"));
    expect(within(modelCard("Pequeno-Q4_K_M")).getByText("Carregado")).toBeInTheDocument();
    await user.click(within(narratorBox()).getByRole("button", { name: "Descarregar" }));
    expect(calls.some((c) => c.url.endsWith("/engine/stop") && c.method === "POST")).toBe(true);
  });

  it("erro ao iniciar aparece no diálogo, que continua aberto", async () => {
    stubFetch({
      statuses: [status({ installed: true })],
      extra: (path) => {
        if (path === "/models/select") return jsonResponse({ active: "a.gguf", name: "x" });
        if (path === "/engine/start") return jsonResponse({ detail: { code: "busy", message: "Espere o download do motor terminar." } }, 409);
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole("heading", { name: "Meus modelos (3)" });
    await user.click(within(modelCard("Pequeno-Q4_K_M")).getByRole("button", { name: "Carregar…" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText(/Memória de vídeo estimada:/);
    await user.click(within(dialog).getByRole("button", { name: "Carregar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Erro: Espere o download do motor terminar.");
  });

  it("modelo selecionado e não carregado: o Narrador oferece Carregar", async () => {
    stubFetch({ statuses: [status({ installed: true, active_model: "b.gguf" })], models: { ...MODELS, active: "b.gguf" } });
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(narratorBox()).toHaveTextContent("Médio-Q8_0"));
    expect(narratorBox()).toHaveTextContent("selecionado, ainda não carregado");
    expect(within(modelCard("Médio-Q8_0")).getByText("Selecionado")).toBeInTheDocument();
    await user.click(within(narratorBox()).getByRole("button", { name: "Carregar" }));
    expect(screen.getByRole("dialog", { name: "Carregar Médio-Q8_0" })).toBeInTheDocument();
  });
});
