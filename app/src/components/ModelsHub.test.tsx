import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EngineStatus } from "../api/engine";
import type { DownloadItem, HubRepo } from "../api/hub";
import { useEngineStatus } from "../hooks/useEngineStatus";
import { jsonResponse } from "../test/fakeFetch";
import { ModelsView } from "./ModelsView";

const info = { port: 5000, token: "t" };
const MB = 2 ** 20;
const GB = 2 ** 30;
const MODELS_DIR = "C:\\dados\\models";
const REPO_ID = "Qwen/Qwen2.5-0.5B-Instruct-GGUF";

const ENGINE: EngineStatus = {
  state: "stopped",
  message: "",
  progress: 0,
  installed: true,
  version: "b1",
  variant: "vulkan",
  verified: true,
  active_model: null,
  active_model_name: null,
  log: "",
  provider: "local",
};

const RESULTS = [
  { id: REPO_ID, author: "Qwen", name: "Qwen2.5-0.5B-Instruct-GGUF", downloads: 506742, likes: 173, license: "apache-2.0", gated: false, restricted: false, updated: "" },
  { id: "fechado/Restrito-GGUF", author: "fechado", name: "Restrito-GGUF", downloads: 10, likes: 1, license: null, gated: true, restricted: true, updated: "" },
];

const SHA = "a".repeat(64);

function repo(patch: Partial<HubRepo> = {}): HubRepo {
  return {
    id: REPO_ID,
    author: "Qwen",
    name: "Qwen2.5-0.5B-Instruct-GGUF",
    revision: "a".repeat(40),
    license: "apache-2.0",
    license_name: null,
    gated: false,
    private: false,
    restricted: false,
    free_bytes: 100 * GB,
    files: [
      { file: "qwen2.5-0.5b-instruct-q4_k_m.gguf", name: "qwen2.5-0.5b-instruct-q4_k_m.gguf", quant: "Q4_K_M", size_bytes: 469 * MB, parts: [{ path: "qwen2.5-0.5b-instruct-q4_k_m.gguf", size: 469 * MB, sha256: SHA }], complete: true, verifiable: true, fit: "gpu", installed: false },
      { file: "big/G-00001-of-00002.gguf", name: "G.gguf", quant: "F16", size_bytes: 40 * GB, parts: [{ path: "big/G-00001-of-00002.gguf", size: 20 * GB, sha256: null }, { path: "big/G-00002-of-00002.gguf", size: 20 * GB, sha256: null }], complete: true, verifiable: false, fit: "pesado_demais", installed: false },
      { file: "m-q8_0.gguf", name: "m-q8_0.gguf", quant: "Q8_0", size_bytes: 9 * GB, parts: [{ path: "m-q8_0.gguf", size: 9 * GB, sha256: "b".repeat(64) }], complete: true, verifiable: true, fit: "cpu_lento", installed: true },
    ],
    ...patch,
  };
}

function download(patch: Partial<DownloadItem> = {}): DownloadItem {
  return {
    id: "d1",
    repo: REPO_ID,
    file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    name: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    state: "downloading",
    done_bytes: 100 * MB,
    total_bytes: 400 * MB,
    progress: 0.25,
    speed_bps: 5 * MB,
    error: null,
    warning: null,
    verified: null,
    model_id: null,
    parts: 1,
    ...patch,
  };
}

const OPTIONS = { context_size: 4096, gpu_layers: "auto" };
const LOCAL = { id: `${REPO_ID}/qwen2.5-0.5b-instruct-q8_0.gguf`, name: "qwen2.5-0.5b-instruct-q8_0.gguf", size_bytes: 469 * MB, quant: "Q8_0", parts: 1, complete: true, fit: "gpu", active: false, source: "app", folder: MODELS_DIR, removable: true, hidden: false, options: OPTIONS };
const EXTRA = { id: "ext:12345678/E.gguf", name: "E.gguf", size_bytes: 10 * MB, quant: null, parts: 1, complete: true, fit: "gpu", active: false, source: "extra", folder: "D:\\LM", removable: false, hidden: false, options: OPTIONS };

type Route = (path: string, init: RequestInit, body: unknown) => Response | undefined | Promise<Response | undefined>;

function stub(route: Route = () => undefined, models: unknown[] = [LOCAL]) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("http://127.0.0.1:5000", "");
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ path, method: init.method ?? "GET", body });
    const custom = await route(path, init, body);
    if (custom) return custom;
    if (path === "/engine/status") return jsonResponse(ENGINE);
    if (path === "/hardware") return jsonResponse({ gpus: [], ram_bytes: 16 * GB, cpu: "", os: "Windows" });
    if (path === "/models") return jsonResponse({ models, models_dir: MODELS_DIR, active: null });
    if (path === "/models/suggestions") return jsonResponse({ suggestions: [], search_terms: ["Stheno-v3.2"] });
    if (path === "/hub/downloads") return jsonResponse({ downloads: [] });
    if (path === "/models/folders") return jsonResponse({ folders: [{ path: MODELS_DIR, kind: "app", exists: true }] });
    throw new Error(`rota inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function Harness({ copyText }: { copyText?: (t: string) => Promise<void> }) {
  const engine = useEngineStatus(info, 10);
  return (
    <ModelsView
      info={info}
      engine={engine.status}
      engineError={engine.error}
      onEngineChange={engine.setStatus}
      refreshEngine={engine.refresh}
      downloadsPollMs={10}
      {...(copyText ? { copyText } : {})}
    />
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function searchFor(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = await screen.findByRole("searchbox", { name: "Buscar modelo" });
  await user.clear(input);
  await user.type(input, `${text}{Enter}`);
}

const tab = (name: RegExp | string) => screen.getByRole("tab", { name });

describe("Modelos — Buscar online", () => {
  it("busca com Enter e mostra repositório, downloads, curtidas, licença e o que você já tem", async () => {
    const calls = stub((path) => (path.startsWith("/hub/search") ? jsonResponse({ results: RESULTS }) : undefined));
    const user = userEvent.setup();
    render(<Harness />);
    await searchFor(user, "Qwen2.5 0.5B");
    const results = await screen.findByRole("list", { name: "Resultados da busca" });
    const items = within(results).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(REPO_ID);
    expect(items[0]).toHaveTextContent("506.742 downloads · 173 curtidas");
    expect(items[0]).toHaveTextContent("Licença: apache-2.0");
    expect(items[0]).toHaveTextContent("Você tem: Q8_0");
    expect(items[1]).toHaveTextContent("Não baixado");
    expect(items[1]).toHaveTextContent("Licença: não informada");
    expect(items[1]).toHaveTextContent("Sem licença informada: confira antes de usar.");
    expect(items[1]).toHaveTextContent("Exige login no Hugging Face; ainda não suportado");
    expect(screen.getByRole("heading", { name: "Para baixar: resultados (2)" })).toBeInTheDocument();
    expect(screen.getByTestId("search-status")).toHaveTextContent("2 repositório(s) encontrado(s).");
    expect(calls.find((c) => c.path.startsWith("/hub/search"))?.path).toBe("/hub/search?q=Qwen2.5%200.5B&limit=20");
  });

  it("botão Buscar online, chip de sugestão de busca e estado vazio", async () => {
    const calls = stub((path) => (path.startsWith("/hub/search") ? jsonResponse({ results: [] }) : undefined));
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(await screen.findByRole("searchbox", { name: "Buscar modelo" }), "nada");
    await user.click(screen.getByRole("button", { name: "Buscar online" }));
    await waitFor(() => expect(screen.getByTestId("search-status")).toHaveTextContent('Nenhum modelo GGUF encontrado para "nada".'));
    await user.click(within(screen.getByRole("group", { name: "Sugestões de busca:" })).getByRole("button", { name: "Stheno-v3.2" }));
    expect(screen.getByRole("searchbox", { name: "Buscar modelo" })).toHaveValue("Stheno-v3.2");
    await waitFor(() => expect(calls.some((c) => c.path === "/hub/search?q=Stheno-v3.2&limit=20")).toBe(true));
  });

  it("erro de rede e limite de requisições viram alerta", async () => {
    let n = 0;
    stub((path) => {
      if (!path.startsWith("/hub/search")) return undefined;
      n++;
      return n === 1
        ? jsonResponse({ detail: { code: "rede", message: "Não foi possível falar com o Hugging Face." } }, 502)
        : jsonResponse({ detail: { code: "limite_requisicoes", message: "O Hugging Face limitou as consultas deste PC." } }, 429);
    });
    const user = userEvent.setup();
    render(<Harness />);
    await searchFor(user, "x");
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível buscar: Não foi possível falar com o Hugging Face.");
    await searchFor(user, "y");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("limitou as consultas"));
  });

  it("Ver arquivos: quantizações com nota, Recomendado e se cabe; Baixar confirma com SHA-256, licença e espaço livre", async () => {
    let started: DownloadItem | null = null;
    const calls = stub((path, init) => {
      if (path.startsWith("/hub/search")) return jsonResponse({ results: RESULTS });
      if (path === `/hub/repos/${REPO_ID}/files`) return jsonResponse(repo({ free_bytes: 30 * GB }));
      if (path === "/hub/downloads" && init.method === "POST") {
        started = download({ state: "queued", done_bytes: 0 });
        return jsonResponse(started, 202);
      }
      if (path === "/hub/downloads") return jsonResponse({ downloads: started ? [started] : [] });
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    await searchFor(user, "qwen");
    const results = await screen.findByRole("list", { name: "Resultados da busca" });
    await user.click(within(within(results).getAllByRole("listitem")[0]!).getByRole("button", { name: "Ver arquivos" }));
    const heading = await screen.findByRole("heading", { name: REPO_ID });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("apache-2.0", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/Espaço livre na pasta de modelos: 30 GB/)).toBeInTheDocument();
    const files = within(screen.getByRole("list", { name: `Arquivos de ${REPO_ID}` })).getAllByRole("listitem");
    expect(files[0]).toHaveTextContent("Recomendado");
    expect(files[0]).toHaveTextContent("qwen2.5-0.5b-instruct-q4_k_m.gguf · 469 MB");
    expect(files[0]).toHaveTextContent("Q4_K_M: Bom equilíbrio. A escolha mais comum.");
    expect(files[0]).toHaveTextContent("Cabe na placa");
    expect(files[1]).toHaveTextContent("G.gguf · 40 GB · 2 partes");
    expect(files[1]).toHaveTextContent("Pesado demais para este PC");
    expect(files[1]).not.toHaveTextContent("Recomendado");
    expect(files[2]).toHaveTextContent("Você já tem");
    expect(within(files[2]!).getByRole("button", { name: "Ver em Meus modelos" })).toBeInTheDocument();

    await user.click(within(files[1]!).getByRole("button", { name: "Baixar" }));
    let dialog = screen.getByRole("dialog", { name: "Baixar F16?" });
    expect(dialog).toHaveTextContent("não publicou o SHA-256");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Não há espaço livre suficiente");
    expect(within(dialog).getByRole("button", { name: "Baixar" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await user.click(within(files[0]!).getByRole("button", { name: "Baixar" }));
    dialog = screen.getByRole("dialog", { name: "Baixar Q4_K_M?" });
    expect(dialog).toHaveTextContent("qwen2.5-0.5b-instruct-q4_k_m.gguf (469 MB) de huggingface.co");
    expect(dialog).toHaveTextContent("Licença: apache-2.0");
    expect(dialog).toHaveTextContent("Espaço livre na pasta de modelos: 30 GB.");
    expect(dialog).toHaveTextContent(SHA);
    await user.click(within(dialog).getByRole("button", { name: "Baixar" }));
    await waitFor(() => expect(tab(/Downloads/)).toHaveAttribute("aria-selected", "true"));
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("Na fila");
    expect(tab(/Downloads/)).toHaveAccessibleName("Downloads (1 ativo)");
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ repo: REPO_ID, file: "qwen2.5-0.5b-instruct-q4_k_m.gguf" });

    await user.click(tab("Modelos"));
    await user.click(screen.getByRole("button", { name: /Voltar à lista/ }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Resultados da busca" })).getAllByRole("button", { name: "Ver arquivos" })[0]).toHaveFocus());
  });

  it("repositório restrito: aviso e botões Baixar desativados", async () => {
    stub((path) => {
      if (path.startsWith("/hub/search")) return jsonResponse({ results: RESULTS });
      if (path.startsWith("/hub/repos/fechado/")) return jsonResponse(repo({ id: "fechado/Restrito-GGUF", restricted: true, gated: true, license: null }));
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    await searchFor(user, "x");
    const results = await screen.findByRole("list", { name: "Resultados da busca" });
    await user.click(within(within(results).getAllByRole("listitem")[1]!).getByRole("button", { name: "Ver arquivos" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Repositório restrito. Exige login no Hugging Face; ainda não suportado.");
    expect(screen.getByText("não informada", { selector: "strong" })).toBeInTheDocument();
    for (const b of screen.getAllByRole("button", { name: "Baixar" })) expect(b).toBeDisabled();
  });
});

describe("Modelos — Downloads", () => {
  it("progresso e velocidade, selo de ativos na aba, e o modelo aparece ao concluir", async () => {
    const queue = [
      [download()],
      [download({ done_bytes: 300 * MB, progress: 0.75 })],
      [download({ state: "verifying", done_bytes: 400 * MB, progress: 1 })],
      [download({ state: "done", done_bytes: 400 * MB, progress: 1, verified: true, speed_bps: 0, model_id: "Qwen/R/q.gguf" })],
    ];
    let done = false;
    let advance = false;
    stub((path) => {
      if (path === "/hub/downloads") {
        const next = advance && queue.length > 1 ? queue.shift()! : queue[0]!;
        if (next[0]!.state === "done") done = true;
        return jsonResponse({ downloads: next });
      }
      if (path === "/models") return jsonResponse({ models: done ? [LOCAL] : [], models_dir: MODELS_DIR, active: null });
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(tab(/Downloads/)).toHaveAccessibleName("Downloads (1 ativo)"));
    await user.click(tab(/Downloads/));
    const bar = await screen.findByRole("progressbar", { name: "qwen2.5-0.5b-instruct-q4_k_m.gguf" });
    expect(bar).toHaveAttribute("aria-valuetext", "25%");
    const list = screen.getByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("Baixando");
    expect(list).toHaveTextContent("100 MB de 400 MB · 25% · 5,0 MB/s");
    expect(within(list).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    advance = true;
    await waitFor(() => expect(list).toHaveTextContent("SHA-256 conferido."));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(tab(/Downloads/)).toHaveAccessibleName("Downloads");
    await waitFor(() => expect(screen.getByTestId("downloads-live")).toHaveTextContent("download concluído e SHA-256 conferido"));
    await user.click(within(list).getByRole("button", { name: "Ver em Meus modelos" }));
    expect(tab("Modelos")).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("heading", { name: "Meus modelos (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Meus modelos 1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cancelar, retomar, remover da lista e limpar concluídos", async () => {
    const state: { items: DownloadItem[] } = { items: [download(), download({ id: "d2", name: "pronto.gguf", state: "done", verified: true, speed_bps: 0 })] };
    const calls = stub((path, init) => {
      if (path === "/hub/downloads" && (init.method ?? "GET") === "GET") return jsonResponse({ downloads: state.items });
      if (path === "/hub/downloads/d1/cancel") {
        state.items = state.items.map((d) => (d.id === "d1" ? download({ state: "cancelled", speed_bps: 0 }) : d));
        return jsonResponse(state.items[0]);
      }
      if (path === "/hub/downloads/d1/retry") {
        state.items = state.items.map((d) => (d.id === "d1" ? download({ state: "error", error: { code: "rede", message: "A conexão caiu durante o download." } }) : d));
        return jsonResponse(state.items[0], 202);
      }
      if (path.startsWith("/hub/downloads/d") && init.method === "DELETE") {
        const id = path.split("/").pop();
        state.items = state.items.filter((d) => d.id !== id);
        return jsonResponse({ removed: id });
      }
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("tab", { name: /Downloads/ }));
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    await user.click(within(list).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(list).toHaveTextContent("Cancelado"));
    expect(screen.getByText(/Remover da lista um download não concluído apaga o que já foi baixado/)).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Retomar" }));
    await waitFor(() => expect(list).toHaveTextContent("A conexão caiu durante o download."));
    await user.click(screen.getByRole("button", { name: "Limpar concluídos" }));
    await waitFor(() => expect(list).not.toHaveTextContent("pronto.gguf"));
    await user.click(within(list).getByRole("button", { name: "Remover da lista" }));
    expect(await screen.findByText(/Nenhum download ainda/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/hub/downloads/d1/cancel" && c.method === "POST")).toBe(true);
    expect(calls.some((c) => c.path === "/hub/downloads/d1/retry" && c.method === "POST")).toBe(true);
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/hub/downloads/d2", "/hub/downloads/d1"]);
  });

  it("interrompido (do disco) oferece Retomar", async () => {
    stub((path) =>
      path === "/hub/downloads"
        ? jsonResponse({ downloads: [download({ id: "disk-1", state: "interrupted", total_bytes: 0, progress: 0, speed_bps: 0 })] })
        : undefined,
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("tab", { name: /Downloads/ }));
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("Interrompido");
    expect(list).toHaveTextContent("100 MB baixados");
    expect(within(list).getByRole("button", { name: "Retomar" })).toBeInTheDocument();
  });

  it("concluído sem SHA-256 mostra aviso, não verificação", async () => {
    stub((path) =>
      path === "/hub/downloads"
        ? jsonResponse({ downloads: [download({ state: "done", verified: false, warning: "O Hugging Face não publicou o SHA-256 deste arquivo." })] })
        : undefined,
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("tab", { name: /Downloads/ }));
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("não publicou o SHA-256");
    expect(list).not.toHaveTextContent("SHA-256 conferido");
  });
});

describe("Modelos — apagar e Procurar neste PC", () => {
  it("Apagar do disco pede confirmação; modelos de pastas extras não podem ser apagados", async () => {
    let removed = false;
    const calls = stub((path, init) => {
      if (path === `/models/${REPO_ID}/qwen2.5-0.5b-instruct-q8_0.gguf` && init.method === "DELETE") {
        removed = true;
        return jsonResponse({ removed: LOCAL.id, files: 1 });
      }
      if (path === "/models") return jsonResponse({ models: removed ? [EXTRA] : [LOCAL, EXTRA], models_dir: MODELS_DIR, active: null });
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    const removeButtons = await screen.findAllByRole("button", { name: "Apagar do disco" });
    expect(removeButtons).toHaveLength(1); // o da pasta extra não tem Apagar
    expect(screen.getByText("O Henduran não apaga modelos de pastas extras.")).toBeInTheDocument();
    expect(screen.getByText("Pasta extra")).toBeInTheDocument();
    await user.click(removeButtons[0]!);
    const dialog = screen.getByRole("dialog", { name: "Apagar qwen2.5-0.5b-instruct-q8_0 do disco?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/Isto apaga o arquivo do disco e não pode ser desfeito\./);
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apagar do disco" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Apagar do disco" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Apagar do disco" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Meus modelos (1)" })).toHaveFocus();
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual([`/models/${REPO_ID}/qwen2.5-0.5b-instruct-q8_0.gguf`]);
  });

  it("pastas: Adicionar pasta… por caminho, erro, sucesso e Remover pasta (nada é apagado)", async () => {
    let folders = [{ path: MODELS_DIR, kind: "app", exists: true }];
    const calls = stub((path, init, body) => {
      if (path === "/models/folders" && init.method === "POST") {
        const p = (body as { path: string }).path;
        if (p === "D:\\nada") return jsonResponse({ detail: { code: "pasta_inexistente", message: "A pasta não existe: D:\\nada" } }, 404);
        folders = [...folders, { path: p, kind: "extra", exists: true }];
        return jsonResponse({ added: folders[1], folders });
      }
      if (path.startsWith("/models/folders?path=") && init.method === "DELETE") {
        folders = folders.slice(0, 1);
        return jsonResponse({ folders });
      }
      if (path === "/models/folders") return jsonResponse({ folders });
      return undefined;
    });
    const copyText = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<Harness copyText={copyText} />);
    await user.click(await screen.findByRole("tab", { name: "Procurar neste PC" }));
    const list = await screen.findByRole("list", { name: "Pastas de modelos" });
    expect(list).toHaveTextContent("Pasta do Henduran");
    await user.click(within(list).getByRole("button", { name: `Copiar o caminho da pasta ${MODELS_DIR}` }));
    expect(copyText).toHaveBeenCalledWith(MODELS_DIR);
    expect(await screen.findByText("Caminho copiado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar pasta…" }));
    const dialog = screen.getByRole("dialog", { name: "Adicionar pasta de modelos" });
    const input = within(dialog).getByLabelText("Caminho completo da pasta");
    await user.type(input, "D:\\nada");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar pasta" }));
    expect(await within(dialog).findByText("A pasta não existe: D:\\nada")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "D:\\LM Studio\\models{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(/Pasta adicionada: D:\\LM Studio\\models/)).toBeInTheDocument();
    expect(list).toHaveTextContent("Pasta extra");
    await user.click(screen.getByRole("button", { name: "Remover da lista a pasta D:\\LM Studio\\models" }));
    expect(await screen.findByText(/nenhum arquivo foi apagado/)).toBeInTheDocument();
    const del = calls.find((c) => c.method === "DELETE");
    expect(del?.path).toBe(`/models/folders?path=${encodeURIComponent("D:\\LM Studio\\models")}`);
    expect(calls.filter((c) => c.path === "/models").length).toBeGreaterThanOrEqual(3);
  });

  it("procurar neste PC lista os .gguf e Usar a pasta deste modelo adiciona a pasta (sem copiar nada)", async () => {
    let folders = [{ path: MODELS_DIR, kind: "app", exists: true }];
    const calls = stub((path, init, body) => {
      if (path === "/models/scan") {
        return jsonResponse({
          found: [
            { path: "C:\\Users\\x\\Downloads\\Phi-3.5-mini-Q4_K_M.gguf", folder: "C:\\Users\\x\\Downloads", name: "Phi-3.5-mini-Q4_K_M.gguf", quant: "Q4_K_M", size_bytes: 2 * GB, parts: 1, complete: true, fit: "gpu" },
          ],
          searched: ["C:\\Users\\x\\Downloads", "C:\\Users\\x\\Documents"],
          truncated: false,
        });
      }
      if (path === "/models/folders" && init.method === "POST") {
        folders = [...folders, { path: (body as { path: string }).path, kind: "extra", exists: true }];
        return jsonResponse({ added: folders[1], folders });
      }
      if (path === "/models/folders") return jsonResponse({ folders });
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("tab", { name: "Procurar neste PC" }));
    await user.click(screen.getByRole("button", { name: "Procurar neste PC" }));
    const found = await screen.findByRole("list", { name: "Modelos encontrados" });
    expect(found).toHaveTextContent("Phi-3.5-mini-Q4_K_M.gguf");
    expect(found).toHaveTextContent("Q4_K_M · 2,0 GB");
    expect(found).toHaveTextContent("C:\\Users\\x\\Downloads\\Phi-3.5-mini-Q4_K_M.gguf");
    expect(screen.getByText(/Pastas procuradas: C:\\Users\\x\\Downloads; C:\\Users\\x\\Documents/)).toBeInTheDocument();
    await user.click(within(found).getByRole("button", { name: "Usar a pasta deste modelo" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Modelos encontrados" })).not.toBeInTheDocument());
    expect(calls.find((c) => c.method === "POST" && c.path === "/models/folders")?.body).toEqual({ path: "C:\\Users\\x\\Downloads" });
    expect(screen.getByText(/Nenhum modelo novo foi encontrado/)).toBeInTheDocument();
  });
});
