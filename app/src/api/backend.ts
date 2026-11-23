import { invoke, isTauri } from "@tauri-apps/api/core";

/** Dados de acesso ao serviço Python local, fornecidos pelo shell Tauri. */
export interface BackendInfo {
  port: number;
  token: string;
}

export interface HealthResponse {
  status: string;
  provider: Record<string, unknown>;
}

/** Erro de um campo, como o serviço devolve nas validações (`errors: [{"field", "code", "message"}]`). */
export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export class BackendError extends Error {
  readonly status: number | undefined;
  /** Código estável do erro, quando o serviço informa (`{"detail": {"code", "message"}}`). */
  readonly code: string | undefined;
  /** Erros por campo (422 de validação); vazio quando o serviço não informa. */
  readonly errors: FieldError[];
  /** Etapa que falhou, quando o serviço informa (por exemplo, `criacao_falhou`). */
  readonly step: string | undefined;

  constructor(message: string, status?: number, code?: string, errors: FieldError[] = [], step?: string) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.step = step;
  }
}

function parseFieldErrors(value: unknown): FieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const e = item as { field?: unknown; code?: unknown; message?: unknown } | null;
    if (!e || typeof e.field !== "string" || typeof e.code !== "string") return [];
    return [{ field: e.field, code: e.code, message: typeof e.message === "string" ? e.message : e.code }];
  });
}

/** Converte uma resposta de erro do serviço em `BackendError`, com código e mensagem se houver. */
export async function errorFromResponse(response: Response): Promise<BackendError> {
  let message = `o serviço respondeu ${response.status}`;
  let code: string | undefined;
  let errors: FieldError[] = [];
  let step: string | undefined;
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (detail && typeof detail === "object") {
      const d = detail as { code?: unknown; message?: unknown; errors?: unknown; step?: unknown };
      if (typeof d.code === "string") code = d.code;
      if (typeof d.message === "string") message = d.message;
      if (typeof d.step === "string") step = d.step;
      errors = parseFieldErrors(d.errors);
    } else if (typeof detail === "string") {
      message = detail;
    }
  } catch {
    // corpo vazio ou não JSON: fica a mensagem genérica
  }
  return new BackendError(message, response.status, code, errors, step);
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

/** `true` dentro do shell Tauri; `false` no navegador (por exemplo, o Vite em desenvolvimento). */
export function canExitApp(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/** Encerra o app pelo shell Tauri (que encerra o serviço Python ao sair). Fora do Tauri, não faz nada. */
export async function exitApp(): Promise<void> {
  if (!canExitApp()) return;
  await invoke("exit_app");
}
