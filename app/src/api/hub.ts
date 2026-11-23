import type { BackendInfo } from "./backend";
import { request, type ModelFit } from "./engine";

/** Repositório encontrado na busca do Hugging Face. Textos vêm de fora: só exibir como texto. */
export interface HubResult {
  id: string;
  author: string;
  name: string;
  downloads: number;
  likes: number;
  license: string | null;
  gated: boolean;
  restricted: boolean;
  updated: string;
}

export interface HubFilePart {
  path: string;
  size: number;
  sha256: string | null;
}

export interface HubFile {
  file: string;
  name: string;
  quant: string | null;
  size_bytes: number;
  parts: HubFilePart[];
  complete: boolean;
  /** `true` se o Hugging Face publicou o SHA-256 de todas as partes. */
  verifiable: boolean;
  fit: ModelFit;
  installed: boolean;
}

export interface HubRepo {
  id: string;
  author: string;
  name: string;
  revision: string;
  license: string | null;
  license_name: string | null;
  gated: boolean;
  private: boolean;
  restricted: boolean;
  files: HubFile[];
  free_bytes: number | null;
}

export type DownloadState = "queued" | "downloading" | "verifying" | "done" | "error" | "cancelled" | "interrupted";

export interface DownloadItem {
  id: string;
  repo: string;
  file: string;
  name: string;
  state: DownloadState;
  done_bytes: number;
  total_bytes: number;
  progress: number;
  speed_bps: number;
  error: { code: string; message: string } | null;
  warning: string | null;
  verified: boolean | null;
  model_id: string | null;
  parts: number;
}

export const ACTIVE_DOWNLOAD_STATES: ReadonlySet<DownloadState> = new Set(["queued", "downloading", "verifying"]);

export const DOWNLOAD_STATE_LABEL: Record<DownloadState, string> = {
  queued: "Na fila",
  downloading: "Baixando",
  verifying: "Conferindo o SHA-256",
  done: "Concluído",
  error: "Erro",
  cancelled: "Cancelado",
  interrupted: "Interrompido",
};

export const searchHub = (info: BackendInfo, query: string, limit = 20) =>
  request<{ results: HubResult[] }>(info, `/hub/search?q=${encodeURIComponent(query)}&limit=${limit}`);

export const fetchRepoFiles = (info: BackendInfo, repo: string) => {
  const [author = "", name = ""] = repo.split("/");
  return request<HubRepo>(info, `/hub/repos/${encodeURIComponent(author)}/${encodeURIComponent(name)}/files`);
};

export const startDownload = (info: BackendInfo, repo: string, file: string) =>
  request<DownloadItem>(info, "/hub/downloads", { method: "POST", body: { repo, file } });

export const fetchDownloads = (info: BackendInfo) => request<{ downloads: DownloadItem[] }>(info, "/hub/downloads");

export const cancelDownload = (info: BackendInfo, id: string) =>
  request<DownloadItem>(info, `/hub/downloads/${encodeURIComponent(id)}/cancel`, { method: "POST" });

export const retryDownload = (info: BackendInfo, id: string) =>
  request<DownloadItem>(info, `/hub/downloads/${encodeURIComponent(id)}/retry`, { method: "POST" });

export const forgetDownload = (info: BackendInfo, id: string) =>
  request<{ removed: string }>(info, `/hub/downloads/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Número inteiro com separador de milhar em português. */
export function formatCount(value: number): string {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)).toLocaleString("pt-BR") : "0";
}

/** Licença para exibir: o identificador do Hugging Face ou "não informada". */
export function licenseLabel(license: string | null, name?: string | null): string {
  if (!license) return "não informada";
  return name && license === "other" ? `${name} (other)` : license;
}
