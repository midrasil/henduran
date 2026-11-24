import { authHeaders, baseUrl, errorFromResponse, type BackendInfo } from "./backend";

export type EngineState = "stopped" | "downloading" | "starting" | "ready" | "error";
export type EngineVariant = "vulkan" | "cpu";
export type ModelFit = "gpu" | "cpu_lento" | "pesado_demais";

export interface EngineStatus {
  state: EngineState;
  message: string;
  progress: number;
  installed: boolean;
  version: string | null;
  variant: EngineVariant | null;
  verified: boolean | null;
  active_model: string | null;
  active_model_name: string | null;
  log: string;
  /** Provedor ativo do Narrador (`local` ou `fake`). */
  provider: string;
}

export interface GpuInfo {
  name: string;
  memory_bytes: number;
}

export interface HardwareInfo {
  gpus: GpuInfo[];
  ram_bytes: number;
  cpu: string;
  os: string;
}

export interface LocalModel {
  id: string;
  name: string;
  size_bytes: number;
  quant: string | null;
  parts: number;
  complete: boolean;
  fit: ModelFit;
  active: boolean;
  /** `app`: pasta de modelos do Henduran; `extra`: pasta extra do jogador (nunca apagada pelo app). */
  source?: "app" | "extra";
  folder?: string | null;
  removable?: boolean;
  /** Oculto pelo jogador (fica na seção recolhida "Ocultos"; nada é apagado). */
  hidden?: boolean;
  /** Ajustes usados ao carregar o motor com este modelo. */
  options?: ModelOptions;
}

export type GpuLayers = "auto" | number;

export interface ModelOptions {
  context_size: number;
  gpu_layers: GpuLayers;
}

/** Estimativa de memória de vídeo de `GET /models/estimate` (aproximada; sem os buffers do motor). */
export interface VramEstimate {
  id: string;
  context_size: number;
  gpu_layers: GpuLayers;
  total_layers: number | null;
  layers_on_gpu: number | null;
  weights_bytes: number | null;
  kv_bytes: number | null;
  vram_bytes: number | null;
  vram_total_bytes: number;
  known: boolean;
  slots: number;
  variant: EngineVariant | null;
}

/** Sugestão da lista do Caliope para este PC (só sugestão; a lista não informa a licença). */
export interface ModelSuggestion {
  name: string;
  quant: string;
  search: string;
  why: string;
  gpu: boolean;
  min_vram_bytes: number;
  license: string | null;
  source: string;
}

/** `.gguf` encontrado ao procurar neste PC (nada é copiado nem movido). */
export interface FoundModel {
  path: string;
  folder: string;
  name: string;
  quant: string | null;
  size_bytes: number;
  parts: number;
  complete: boolean;
  fit: ModelFit;
}

export interface ModelFolder {
  path: string;
  kind: "app" | "extra";
  exists: boolean;
}

export interface ModelsResponse {
  models: LocalModel[];
  models_dir: string;
  active: string | null;
}

export interface EngineRelease {
  tag: string;
  variant: EngineVariant;
  name: string;
  url: string;
  size: number;
  digest: string | null;
  verifiable: boolean;
}

export async function request<T>(
  info: BackendInfo,
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders(info) };
  const options: RequestInit = { method: init.method ?? "GET", headers };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(init.body);
  }
  const response = await fetch(`${baseUrl(info)}${path}`, options);
  if (!response.ok) throw await errorFromResponse(response);
  return (await response.json()) as T;
}

export const fetchEngineStatus = (info: BackendInfo) => request<EngineStatus>(info, "/engine/status");
export const fetchHardware = (info: BackendInfo) => request<HardwareInfo>(info, "/hardware");
export const fetchModels = (info: BackendInfo) => request<ModelsResponse>(info, "/models");

export const fetchEngineRelease = (info: BackendInfo, variant: EngineVariant) =>
  request<EngineRelease>(info, `/engine/release?variant=${encodeURIComponent(variant)}`);

export const installEngine = (info: BackendInfo, variant: EngineVariant, allowUnverified = false) =>
  request<EngineStatus>(info, "/engine/install", {
    method: "POST",
    body: { variant, allow_unverified: allowUnverified },
  });

export const selectModel = (info: BackendInfo, id: string, options?: Partial<ModelOptions>) =>
  request<{ active: string; name: string; options?: ModelOptions }>(info, "/models/select", {
    method: "POST",
    body: { id, ...(options ?? {}) },
  });

/** Oculta ou mostra um modelo na lista (nada é apagado). */
export const setModelHidden = (info: BackendInfo, id: string, hidden: boolean) =>
  request<{ id: string; hidden: boolean }>(info, "/models/hidden", { method: "POST", body: { id, hidden } });

export const fetchEstimate = (info: BackendInfo, id: string, contextSize: number, gpuLayers: GpuLayers) =>
  request<VramEstimate>(
    info,
    `/models/estimate?id=${encodeURIComponent(id)}&context_size=${contextSize}&gpu_layers=${encodeURIComponent(String(gpuLayers))}`,
  );

export const fetchSuggestions = (info: BackendInfo) =>
  request<{ suggestions: ModelSuggestion[]; search_terms: string[] }>(info, "/models/suggestions");

/** Procura `.gguf` nas pastas comuns deste PC (Downloads, LM Studio, Documentos). */
export const scanPc = (info: BackendInfo) =>
  request<{ found: FoundModel[]; searched: string[]; truncated: boolean }>(info, "/models/scan");

export const startEngine = (info: BackendInfo) =>
  request<EngineStatus>(info, "/engine/start", { method: "POST" });

export const stopEngine = (info: BackendInfo) =>
  request<EngineStatus>(info, "/engine/stop", { method: "POST" });

/** Apaga do disco um modelo da pasta do app (todas as partes). */
export const removeModel = (info: BackendInfo, id: string) =>
  request<{ removed: string; files: number }>(info, `/models/${id.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE",
  });

export const fetchFolders = (info: BackendInfo) => request<{ folders: ModelFolder[] }>(info, "/models/folders");

export const addFolder = (info: BackendInfo, path: string) =>
  request<{ added: ModelFolder; folders: ModelFolder[] }>(info, "/models/folders", { method: "POST", body: { path } });

/** Tira uma pasta extra da lista (nenhum arquivo é apagado). */
export const removeFolder = (info: BackendInfo, path: string) =>
  request<{ folders: ModelFolder[] }>(info, `/models/folders?path=${encodeURIComponent(path)}`, { method: "DELETE" });

/** Tamanho legível em português (base 1024, vírgula decimal). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "desconhecido";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}

export const FIT_LABEL: Record<ModelFit, string> = {
  gpu: "Cabe na placa",
  cpu_lento: "Roda na CPU, lento",
  pesado_demais: "Pesado demais para este PC",
};

export const STATE_LABEL: Record<EngineState, string> = {
  stopped: "Parado",
  downloading: "Baixando",
  starting: "Carregando o modelo…",
  ready: "Pronto",
  error: "Erro",
};
