import { useEffect, useState } from "react";

import { fetchHealth, getBackendInfo, type BackendInfo } from "../api/backend";

export type BackendStatus =
  | { kind: "starting" }
  | { kind: "connected"; info: BackendInfo }
  | { kind: "error"; message: string };

export interface UseBackendOptions {
  /** Tentativas de `/health` antes de desistir. */
  attempts?: number;
  /** Intervalo entre tentativas, em ms. */
  retryDelayMs?: number;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "falha desconhecida";
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Obtém porta e token do shell Tauri e confirma que o serviço responde. */
export function useBackend({ attempts = 10, retryDelayMs = 300 }: UseBackendOptions = {}) {
  const [status, setStatus] = useState<BackendStatus>({ kind: "starting" });

  useEffect(() => {
    let active = true;

    (async () => {
      let info: BackendInfo;
      try {
        info = await getBackendInfo();
      } catch (error) {
        if (active) setStatus({ kind: "error", message: describe(error) });
        return;
      }

      let lastError: unknown;
      for (let attempt = 0; attempt < attempts && active; attempt++) {
        try {
          await fetchHealth(info);
          if (active) setStatus({ kind: "connected", info });
          return;
        } catch (error) {
          lastError = error;
          if (attempt < attempts - 1) await wait(retryDelayMs);
        }
      }
      if (active) {
        setStatus({ kind: "error", message: `serviço indisponível (${describe(lastError)})` });
      }
    })();

    return () => {
      active = false;
    };
  }, [attempts, retryDelayMs]);

  return status;
}
