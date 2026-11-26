import { useEffect, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { fetchPortraitAt } from "../api/journeys";

/** A rota exige token; o retrato é exibido por uma URL local revogada ao trocar. */
export function usePortraitUrl(info: BackendInfo | null, urlPath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!info || !urlPath || typeof URL.createObjectURL !== "function") return;
    const controller = new AbortController();
    let created: string | null = null;
    fetchPortraitAt(info, urlPath, controller.signal)
      .then((blob) => {
        if (!blob || controller.signal.aborted) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => undefined); // sem retrato, as iniciais
    return () => {
      controller.abort();
      if (created && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(created);
    };
  }, [info, urlPath]);
  return url;
}
