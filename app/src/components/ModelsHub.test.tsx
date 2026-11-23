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
  { id: "Qwen/Qwen2.5-0.5B-Instruct-GGUF", author: "Qwen", name: "Qwen2.5-0.5B-Instruct-GGUF", downloads: 506742, likes: 173, license: "apache-2.0", gated: false, restricted: false, updated: "" },
  { id: "fechado/Restrito-GGUF", author: "fechado", name: "Restrito-GGUF", downloads: 10, likes: 1, license: null, gated: true, restricted: true, updated: "" },
];

function repo(patch: Partial<HubRepo> = {}): HubRepo {
  return {
    id: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
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
      { file: "qwen2.5-0.5b-instruct-q4_k_m.gguf", name: "qwen2.5-0.5b-instruct-q4_k_m.gguf", quant: "Q4_K_M", size_bytes: 469 * MB, parts: [{ path: "qwen2.5-0.5b-instruct-q4_k_m.gguf", size: 469 * MB, sha256: "a".repeat(64) }], complete: true, verifiable: true, fit: "gpu", installed: false },
      { file: "big/G-00001-of-00002.gguf", name: "G.gguf", quant: "F16", size_bytes: 40 * GB, parts: [{ path: "big/G-00001-of-00002.gguf", size: 20 * GB, sha256: null }, { path: "big/G-00002-of-00002.gguf", size: 20 * GB, sha256: null }], complete: true, verifiable: false, fit: "pesado_demais", installed: false },
      { file: "m-q8_0.gguf", name: "m-q8_0.gguf", quant: "Q8_0", size_bytes: 9 * GB, parts: [{ path: "m-q8_0.gguf", size: 9 * GB, sha256: "b".repeat(64) }], complete: true, verifiable: true, fit: "cpu_lento", installed: false },
    ],
    ...patch,
  };
}

function download(patch: Partial<DownloadItem> = {}): DownloadItem {
  return {
    id: "d1",
    repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
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

const LOCAL = { id: "Qwen/R/q.gguf", name: "q.gguf", size_bytes: 469 * MB, quant: "Q4_K_M", parts: 1, complete: true, fit: "gpu", active: false, source: "app", folder: MODELS_DIR, removable: true };
const EXTRA = { id: "ext:12345678/E.gguf", name: "E.gguf", size_bytes: 10 * MB, quant: null, parts: 1, complete: true, fit: "gpu", active: false, source: "extra", folder: "D:\\LM", removable: false };

type Route = (path: string, init: RequestInit, body: unknown) => Response | undefined | Promise<Response | undefined>;

function stub(route: Route = () => undefined, models: unknown[] = []) {
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
    if (path === "/hub/downloads") return jsonResponse({ downloads: [] });
    if (path === "/models/folders") return jsonResponse({ folders: [{ path: MODELS_DIR, kind: "app", exists: true }] });
    throw new Error(`rota inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function Harness() {
  const engine = useEngineStatus(info, 10);
  return (
    <ModelsView
      info={info}
      engine={engine.status}
      engineError={engine.error}
      onEngineChange={engine.setStatus}
      refreshEngine={engine.refresh}
      downloadsPollMs={10}
    />
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function searchFor(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = await screen.findByLabelText("Nome do modelo");
  await user.clear(input);
  await user.type(input, `${text}{Enter}`);
}

describe("Modelos — busca no Hugging Face", () => {
  it("busca com Enter e mostra nome, autor, downloads, curtidas e licença", async () => {
    const calls = stub((path) => (path.startsWith("/hub/search") ? jsonResponse({ results: RESULTS }) : undefined));
    const user = userEvent.setup();
    render(<Harness />);
    await searchFor(user, "Qwen2.5 0.5B");
    const results = await screen.findByRole("list", { name: "Resultados da busca" });
    const items = within(results).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Qwen/Qwen2.5-0.5B-Instruct-GGUF");
    expect(items[0]).toHaveTextContent("506.742 downloads · 173 curtidas · licença apache-2.0");
    expect(items[1]).toHaveTextContent("licença não informada");
    expect(items[1]).toHaveTextContent("Exige login no Hugging Face; ainda não suportado");
    expect(screen.getByTestId("search-status")).toHaveTextContent("2 repositório(s) encontrado(s).");
    expect(calls.find((c) => c.path.startsWith("/hub/search"))?.path).toBe("/hub/search?q=Qwen2.5%200.5B&limit=20");
  });

  it("botão Buscar e estado vazio", async () => {
    stub((path) => (path.startsWith("/hub/search") ? jsonResponse({ results: [] }) : undefined));
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(await screen.findByLabelText("Nome do modelo"), "nada");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(screen.getByTestId("search-status")).toHaveTextContent('Nenhum modelo GGUF encontrado para "nada".'),
    );
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

  it("detalhe: arquivos com tamanho, quantização, compatibilidade e licença; confirma com espaço livre", async () => {
    const calls = stub((path, init) => {
      if (path.startsWith("/hub/search")) return jsonResponse({ results: RESULTS });
      if (path === "/hub/repos/Qwen/Qwen2.5-0.5B-Instruct-GGUF/files") return jsonResponse(repo({ free_bytes: 30 * GB }));
      if (path === "/hub/downloads" && init.method === "POST") return jsonResponse(download({ state: "queued", done_bytes: 0 }), 202);
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    await searchFor(user, "qwen");
    await user.click(await screen.findByRole("button", { name: "Qwen/Qwen2.5-0.5B-Instruct-GGUF" }));
    const heading = await screen.findByRole("heading", { name: "Qwen/Qwen2.5-0.5B-Instruct-GGUF" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("apache-2.0", { selector: "strong" })).toBeInTheDocument();
    const files = within(screen.getByRole("list", { name: "Arquivos de Qwen/Qwen2.5-0.5B-Instruct-GGUF" })).getAllByRole("listitem");
    expect(files[0]).toHaveTextContent("Q4_K_M · 469 MB");
    expect(files[0]).toHaveTextContent("Cabe na sua placa");
    expect(files[1]).toHaveTextContent("F16 · 40 GB · 2 partes");
    expect(files[1]).toHaveTextContent("Pesado demais para este PC");
    expect(files[2]).toHaveTextContent("Vai rodar no processador, mais lento");

    await user.click(within(files[0]!).getByRole("button", { name: "Baixar" }));
    const confirm = within(files[0]!).getByRole("group");
    expect(confirm).toHaveTextContent("Baixar qwen2.5-0.5b-instruct-q4_k_m.gguf (469 MB) de huggingface.co?");
    expect(confirm).toHaveTextContent("Espaço livre na pasta de modelos: 30 GB.");
    expect(confirm).toHaveTextContent("conferida pelo SHA-256");
    await user.click(within(confirm).getByRole("button", { name: "Confirmar download" }));
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("Na fila");
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
      file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    });

    await user.click(within(files[1]!).getByRole("button", { name: "Baixar" }));
    expect(within(files[1]!).getByRole("group")).toHaveTextContent("não publicou o SHA-256");
    expect(within(files[1]!).getByRole("alert")).toHaveTextContent("Não há espaço livre suficiente");
    expect(within(files[1]!).getByRole("button", { name: "Confirmar download" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Voltar aos resultados" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Qwen/Qwen2.5-0.5B-Instruct-GGUF" })).toHaveFocus());
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
    await user.click(await screen.findByRole("button", { name: "fechado/Restrito-GGUF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Repositório restrito. Exige login no Hugging Face; ainda não suportado.");
    expect(screen.getByText("não informada", { selector: "strong" })).toBeInTheDocument();
    for (const b of screen.getAllByRole("button", { name: "Baixar" })) expect(b).toBeDisabled();
  });
});

describe("Modelos — downloads", () => {
  it("mostra progresso e velocidade, consulta enquanto ativo e o modelo aparece ao concluir", async () => {
    const queue = [
      [download()],
      [download({ done_bytes: 300 * MB, progress: 0.75 })],
      [download({ state: "verifying", done_bytes: 400 * MB, progress: 1 })],
      [download({ state: "done", done_bytes: 400 * MB, progress: 1, verified: true, speed_bps: 0, model_id: "Qwen/R/q.gguf" })],
    ];
    let done = false;
    stub((path) => {
      if (path === "/hub/downloads") {
        const next = queue.length > 1 ? queue.shift()! : queue[0]!;
        if (next[0]!.state === "done") done = true;
        return jsonResponse({ downloads: next });
      }
      if (path === "/models") return jsonResponse({ models: done ? [LOCAL] : [], models_dir: MODELS_DIR, active: null });
      return undefined;
    });
    render(<Harness />);
    const bar = await screen.findByRole("progressbar", { name: "qwen2.5-0.5b-instruct-q4_k_m.gguf" });
    expect(bar).toHaveAttribute("aria-valuetext", "25%");
    const list = screen.getByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("Baixando · 25% · 5,0 MB/s");
    expect(list).toHaveTextContent("100 MB de 400 MB");
    expect(within(list).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveTextContent("Integridade conferida pelo SHA-256 publicado."));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Usar este modelo" })).toBeEnabled();
    expect(screen.getByTestId("downloads-live")).toHaveTextContent("download concluído e SHA-256 conferido");
  });

  it("cancelar, tentar de novo e limpar", async () => {
    const state = { item: download() };
    const calls = stub((path, init) => {
      if (path === "/hub/downloads" && (init.method ?? "GET") === "GET") return jsonResponse({ downloads: state.item ? [state.item] : [] });
      if (path === "/hub/downloads/d1/cancel") {
        state.item = download({ state: "cancelled", speed_bps: 0 });
        return jsonResponse(state.item);
      }
      if (path === "/hub/downloads/d1/retry") {
        state.item = download({ state: "error", error: { code: "rede", message: "A conexão caiu durante o download." } });
        return jsonResponse(state.item, 202);
      }
      if (path === "/hub/downloads/d1" && init.method === "DELETE") return jsonResponse({ removed: "d1" });
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    await user.click(within(list).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(list).toHaveTextContent("Cancelado"));
    expect(screen.getByText(/Limpar um download não concluído apaga o que já foi baixado/)).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(list).toHaveTextContent("A conexão caiu durante o download."));
    await user.click(within(list).getByRole("button", { name: "Limpar" }));
    expect(await screen.findByText(/Nenhum download/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/hub/downloads/d1/cancel" && c.method === "POST")).toBe(true);
    expect(calls.some((c) => c.path === "/hub/downloads/d1/retry" && c.method === "POST")).toBe(true);
    expect(calls.some((c) => c.path === "/hub/downloads/d1" && c.method === "DELETE")).toBe(true);
  });

  it("interrompido (do disco) oferece Tentar de novo", async () => {
    stub((path) =>
      path === "/hub/downloads"
        ? jsonResponse({ downloads: [download({ id: "disk-1", state: "interrupted", total_bytes: 0, progress: 0, speed_bps: 0 })] })
        : undefined,
    );
    render(<Harness />);
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("Interrompido");
    expect(list).toHaveTextContent("100 MB baixados");
    expect(within(list).getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("concluído sem SHA-256 mostra aviso, não verificação", async () => {
    stub((path) =>
      path === "/hub/downloads"
        ? jsonResponse({ downloads: [download({ state: "done", verified: false, warning: "O Hugging Face não publicou o SHA-256 deste arquivo." })] })
        : undefined,
    );
    render(<Harness />);
    const list = await screen.findByRole("list", { name: "Lista de downloads" });
    expect(list).toHaveTextContent("não publicou o SHA-256");
    expect(list).not.toHaveTextContent("Integridade conferida");
  });
});

describe("Modelos — remover e pastas", () => {
  it("Remover pede confirmação dizendo que apaga do disco", async () => {
    let removed = false;
    const calls = stub((path, init) => {
      if (path === "/models/Qwen/R/q.gguf" && init.method === "DELETE") {
        removed = true;
        return jsonResponse({ removed: "Qwen/R/q.gguf", files: 1 });
      }
      if (path === "/models") return jsonResponse({ models: removed ? [] : [LOCAL, EXTRA], models_dir: MODELS_DIR, active: null });
      return undefined;
    });
    const user = userEvent.setup();
    render(<Harness />);
    const removeButtons = await screen.findAllByRole("button", { name: "Remover" });
    expect(removeButtons).toHaveLength(1); // o da pasta extra não tem Remover
    expect(screen.getByText("O Henduran não apaga modelos de pastas extras.")).toBeInTheDocument();
    await user.click(removeButtons[0]!);
    const dialog = screen.getByRole("dialog", { name: "Apagar q.gguf do disco?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/Isto apaga o arquivo do disco e não pode ser desfeito\./);
    // Em confirmação destrutiva, o foco começa no Cancelar.
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover" })).toHaveFocus();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Apagar do disco" }));
    expect(await screen.findByText("q.gguf foi apagado do disco.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Modelos locais" })).toHaveFocus();
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/models/Qwen/R/q.gguf"]);
  });

  it("pastas extras: lista, adiciona por caminho digitado e tira da lista", async () => {
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
    const user = userEvent.setup();
    render(<Harness />);
    const list = await screen.findByRole("list", { name: "Pastas de modelos" });
    expect(list).toHaveTextContent("pasta do Henduran");
    const input = screen.getByLabelText("Caminho completo da pasta");
    await user.type(input, "D:\\nada");
    await user.click(screen.getByRole("button", { name: "Adicionar pasta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A pasta não existe: D:\\nada");
    await user.clear(input);
    await user.type(input, "D:\\LM Studio\\models{Enter}");
    expect(await screen.findByText("Pasta adicionada: D:\\LM Studio\\models")).toBeInTheDocument();
    expect(list).toHaveTextContent("pasta extra");
    await user.click(screen.getByRole("button", { name: "Tirar da lista a pasta D:\\LM Studio\\models" }));
    expect(await screen.findByText(/nenhum arquivo foi apagado/)).toBeInTheDocument();
    const del = calls.find((c) => c.method === "DELETE");
    expect(del?.path).toBe(`/models/folders?path=${encodeURIComponent("D:\\LM Studio\\models")}`);
    expect(calls.filter((c) => c.path === "/models").length).toBeGreaterThanOrEqual(3);
  });
});
