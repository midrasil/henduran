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

export const selectModel = (info: BackendInfo, id: string) =>
  request<{ active: string; name: string }>(info, "/models/select", { method: "POST", body: { id } });

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
  gpu: "Cabe na sua placa",
  cpu_lento: "Vai rodar no processador, mais lento",
  pesado_demais: "Pesado demais para este PC",
};

export const STATE_LABEL: Record<EngineState, string> = {
  stopped: "Parado",
  downloading: "Baixando",
  starting: "Carregando o modelo…",
  ready: "Pronto",
  error: "Erro",
};
