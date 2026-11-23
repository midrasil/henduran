import { useCallback, useEffect, useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { ACTIVE_DOWNLOAD_STATES, fetchDownloads, type DownloadItem } from "../api/hub";

/** Intervalo de consulta enquanto houver download ativo. */
export const DOWNLOADS_POLL_MS = 1000;

/**
 * Downloads de modelos. Consulta `/hub/downloads` ao abrir e, depois, a cada ~1 s
 * **somente** enquanto houver um download ativo. `onCompleted` é chamado quando um
 * download passa a `done` (para atualizar a lista de modelos locais).
 */
export function useDownloads(
  info: BackendInfo,
  { pollMs = DOWNLOADS_POLL_MS, onCompleted }: { pollMs?: number; onCompleted?: (item: DownloadItem) => void } = {},
) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previous = useRef<Map<string, DownloadItem["state"]>>(new Map());
  const completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const { downloads: next } = await fetchDownloads(info);
      if (!mounted.current) return;
      for (const item of next) {
        const before = previous.current.get(item.id);
        if (item.state === "done" && before !== undefined && before !== "done") completedRef.current?.(item);
      }
      previous.current = new Map(next.map((d) => [d.id, d.state]));
      setDownloads(next);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "falha ao consultar os downloads");
    }
  }, [info]);

  /** Junta um item recebido de uma ação (iniciar, cancelar, tentar de novo) sem esperar a próxima consulta. */
  const upsert = useCallback((item: DownloadItem) => {
    if (!previous.current.has(item.id)) previous.current.set(item.id, item.state);
    setDownloads((list) => {
      const index = list.findIndex((d) => d.id === item.id);
      if (index < 0) return [...list, item];
      const copy = list.slice();
      copy[index] = item;
      return copy;
    });
  }, []);

  const drop = useCallback((id: string) => {
    previous.current.delete(id);
    setDownloads((list) => list.filter((d) => d.id !== id));
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const active = downloads.some((d) => ACTIVE_DOWNLOAD_STATES.has(d.state));
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => void refresh(), pollMs);
    return () => clearTimeout(timer);
  }, [active, downloads, pollMs, refresh]);

  return { downloads, error, refresh, upsert, drop, active };
}
