import { invoke } from "@tauri-apps/api/core";

/** Dados de acesso ao serviço Python local, fornecidos pelo shell Tauri. */
export interface BackendInfo {
  port: number;
  token: string;
}

export interface HealthResponse {
  status: string;
  provider: Record<string, unknown>;
}

export class BackendError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

export function baseUrl(info: BackendInfo): string {
  return `http://127.0.0.1:${info.port}`;
}

export function authHeaders(info: BackendInfo): Record<string, string> {
  return { Authorization: `Bearer ${info.token}` };
}

/** Pede ao Rust a porta e o token do serviço; espera o serviço anunciar que está pronto. */
export async function getBackendInfo(): Promise<BackendInfo> {
  return invoke<BackendInfo>("get_backend_info");
}

export async function fetchHealth(info: BackendInfo, signal?: AbortSignal): Promise<HealthResponse> {
  const init: RequestInit = { headers: authHeaders(info) };
  if (signal) init.signal = signal;
  const response = await fetch(`${baseUrl(info)}/health`, init);
  if (!response.ok) {
    throw new BackendError(`o serviço respondeu ${response.status}`, response.status);
  }
  return (await response.json()) as HealthResponse;
}
