import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EngineStatus } from "../api/engine";
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

const MODELS = {
  models_dir: "C:\\Users\\x\\AppData\\Local\\Henduran\\models",
  active: null as string | null,
  models: [
    { id: "a.gguf", name: "Pequeno-Q4_K_M.gguf", size_bytes: 400 * 2 ** 20, quant: "Q4_K_M", parts: 1, complete: true, fit: "gpu", active: false },
    { id: "b.gguf", name: "Medio-Q8_0.gguf", size_bytes: 9 * GB, quant: "Q8_0", parts: 1, complete: true, fit: "cpu_lento", active: false },
    { id: "c.gguf", name: "Enorme-F16.gguf", size_bytes: 40 * GB, quant: "F16", parts: 1, complete: true, fit: "pesado_demais", active: false },
  ],
};

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
    throw new Error(`rota inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const pass = () => new Response(null, { status: 599 });

function Harness({ copyText }: { copyText?: (t: string) => Promise<void> }) {
  const engine = useEngineStatus(info, 10);
  return (
    <ModelsView
      info={info}
      engine={engine.status}
      engineError={engine.error}
      onEngineChange={engine.setStatus}
      refreshEngine={engine.refresh}
      {...(copyText ? { copyText } : {})}
    />
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ModelsView", () => {
  it("mostra o hardware do PC", async () => {
    stubFetch();
    render(<Harness />);
    expect(await screen.findByText("Radeon Teste — 8,0 GB")).toBeInTheDocument();
    expect(screen.getByText("16 GB")).toBeInTheDocument();
    expect(screen.getByText("Ryzen Teste")).toBeInTheDocument();
  });

  it("sem motor: mostra o tamanho antes e baixa com a variante escolhida após confirmar", async () => {
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
    expect(await screen.findByRole("status")).toHaveTextContent("Parado");
    expect(screen.getByRole("radio", { name: /Vulkan/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /CPU/ }));
    await user.click(screen.getByRole("button", { name: "Baixar o motor de IA" }));

    const confirm = await screen.findByRole("group");
    expect(confirm).toHaveTextContent("llama-b12635-bin-win-cpu-x64.zip (25 MB), versão b12635");
    expect(calls.some((c) => c.url.endsWith("/engine/release?variant=cpu"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/engine/install"))).toBe(false);

    await user.click(within(confirm).getByRole("button", { name: "Confirmar download" }));
    const install = calls.find((c) => c.url.endsWith("/engine/install"));
    expect(install?.body).toEqual({ variant: "cpu", allow_unverified: false });
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
    await user.click(await screen.findByRole("button", { name: "Baixar o motor de IA" }));
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
    expect(screen.getByRole("status")).toHaveTextContent("Baixando: Baixando o motor de IA…");
    expect(await screen.findByText("Versão b12635 (Vulkan)")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("instalado");
  });

  it("sem modelo: mostra a pasta e copia o caminho", async () => {
    stubFetch({ statuses: [status({ installed: true, version: "b1", variant: "vulkan" })], models: { ...MODELS, models: [] } });
    const copyText = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<Harness copyText={copyText} />);
    expect(await screen.findByText(/Nenhum modelo \.gguf encontrado/)).toBeInTheDocument();
    expect(screen.getByText(MODELS.models_dir)).toBeInTheDocument();
    expect(screen.getByText("O download de modelos dentro do app virá em breve.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar caminho" }));
    expect(copyText).toHaveBeenCalledWith(MODELS.models_dir);
    expect(await screen.findByText("Caminho copiado.")).toBeInTheDocument();
  });

  it("lista os modelos com tamanho, quantização e compatibilidade em português", async () => {
    stubFetch({ statuses: [status({ installed: true })] });
    render(<Harness />);
    const items = await screen.findAllByRole("listitem");
    const small = items.find((li) => li.textContent?.includes("Pequeno-Q4_K_M.gguf"));
    expect(small).toHaveTextContent("400 MB · Q4_K_M");
    expect(small).toHaveTextContent("Cabe na sua placa");
    expect(screen.getByText("Vai rodar no processador, mais lento")).toBeInTheDocument();
    expect(screen.getByText("Pesado demais para este PC")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Usar este modelo" });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toBeEnabled();
    expect(buttons[0]).toHaveAccessibleDescription("Pequeno-Q4_K_M.gguf");
  });

  it("sem motor instalado, os botões de modelo ficam desativados com explicação", async () => {
    stubFetch({ statuses: [status({ installed: false })] });
    render(<Harness />);
    const buttons = await screen.findAllByRole("button", { name: "Usar este modelo" });
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText("Baixe o motor de IA antes de usar um modelo.")).toBeInTheDocument();
  });

  it("Usar este modelo seleciona, inicia e mostra Carregando e depois Pronto", async () => {
    const after = { ...MODELS, active: "a.gguf" };
    let selected = false;
    const calls = stubFetch({
      statuses: [
        status({ installed: true }),
        status({ installed: true, state: "starting", message: "Carregando o modelo…", active_model: "a.gguf" }),
        status({ installed: true, state: "ready", message: "Pronto", active_model: "a.gguf" }),
      ],
      extra: (path) => {
        if (path === "/models/select") {
          selected = true;
          return jsonResponse({ active: "a.gguf", name: "Pequeno-Q4_K_M.gguf" });
        }
        if (path === "/engine/start") {
          return jsonResponse(status({ installed: true, state: "starting", message: "Carregando o modelo…", active_model: "a.gguf" }), 202);
        }
        if (path === "/models" && selected) return jsonResponse(after);
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    const [first] = await screen.findAllByRole("button", { name: "Usar este modelo" });
    await user.click(first!);
    expect(calls.find((c) => c.url.endsWith("/models/select"))?.body).toEqual({ id: "a.gguf" });
    expect(calls.some((c) => c.url.endsWith("/engine/start") && c.method === "POST")).toBe(true);
    expect(await screen.findByText("Ativo")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Carregando o modelo…"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Pronto$/));
    expect(screen.getByRole("button", { name: "Parar o motor" })).toBeInTheDocument();
  });

  it("erro: mostra a mensagem e o final do log do motor", async () => {
    stubFetch({
      statuses: [status({
        installed: true,
        state: "error",
        message: "O motor parou enquanto carregava o modelo.",
        log: "ggml_vulkan: ErrorOutOfDeviceMemory",
      })],
    });
    render(<Harness />);
    expect(await screen.findByRole("status")).toHaveTextContent("Erro: O motor parou enquanto carregava o modelo.");
    expect(screen.getByLabelText("Final do log do motor")).toHaveTextContent("ErrorOutOfDeviceMemory");
  });

  it("erro ao iniciar vira alerta com a mensagem do serviço", async () => {
    stubFetch({
      statuses: [status({ installed: true })],
      extra: (path) => {
        if (path === "/models/select") return jsonResponse({ active: "a.gguf", name: "x" });
        if (path === "/engine/start") {
          return jsonResponse({ detail: { code: "busy", message: "Espere o download do motor terminar." } }, 409);
        }
        return pass();
      },
    });
    const user = userEvent.setup();
    render(<Harness />);
    const [first] = await screen.findAllByRole("button", { name: "Usar este modelo" });
    await user.click(first!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro: Espere o download do motor terminar.");
  });
});
