import { useCallback, useEffect, useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { fetchEngineStatus, type EngineStatus } from "../api/engine";

/** Intervalo de consulta enquanto o motor baixa ou carrega. */
export const ENGINE_POLL_MS = 1500;

const BUSY = new Set(["downloading", "starting"]);

/**
 * Estado do motor de IA. Consulta `/engine/status` ao conectar e, depois,
 * a cada ~1,5 s **somente** enquanto o estado for `downloading` ou `starting`.
 */
export function useEngineStatus(info: BackendInfo | null, pollMs = ENGINE_POLL_MS) {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  const refresh = useCallback(async (): Promise<EngineStatus | null> => {
    if (!info) return null;
    try {
      const next = await fetchEngineStatus(info);
      if (activeRef.current) {
        setStatus(next);
        setError(null);
      }
      return next;
    } catch (err) {
      if (activeRef.current) setError(err instanceof Error ? err.message : "falha ao consultar o motor");
      return null;
    }
  }, [info]);

  useEffect(() => {
    activeRef.current = true;
    void refresh();
    return () => {
      activeRef.current = false;
    };
  }, [refresh]);

  const busy = status !== null && BUSY.has(status.state);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => void refresh(), pollMs);
    return () => clearTimeout(timer);
  }, [busy, status, pollMs, refresh]);

  return { status, error, refresh, setStatus };
}
