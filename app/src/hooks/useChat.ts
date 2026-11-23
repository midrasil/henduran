import { useCallback, useEffect, useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { cancelChat, isAbortError, streamChat, type ChatMessagePayload } from "../api/chatStream";

export interface ChatEntry {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** A resposta foi interrompida pelo jogador. */
  interrupted?: boolean;
  /** A resposta falhou. */
  failed?: boolean;
}

const FALLBACK_ERROR = "Não foi possível obter a resposta do Narrador.";

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : FALLBACK_ERROR;
}

/** Estado do chat e operações de envio e cancelamento. */
export function useChat(info: BackendInfo | null) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = useRef(1);
  const entriesRef = useRef<ChatEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const update = useCallback((fn: (prev: ChatEntry[]) => ChatEntry[]) => {
    setEntries((prev) => {
      const next = fn(prev);
      entriesRef.current = next;
      return next;
    });
  }, []);

  const patchEntry = useCallback(
    (id: number, patch: (entry: ChatEntry) => ChatEntry) => {
      update((prev) => prev.map((entry) => (entry.id === id ? patch(entry) : entry)));
    },
    [update],
  );

  // Ao desmontar, fecha qualquer geração em curso.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!info || !content || abortRef.current) return;

      const history: ChatMessagePayload[] = entriesRef.current
        .filter((entry) => !entry.failed && entry.content.length > 0)
        .map((entry) => ({ role: entry.role, content: entry.content }));
      history.push({ role: "user", content });

      const userId = nextId.current++;
      const assistantId = nextId.current++;
      update((prev) => [
        ...prev,
        { id: userId, role: "user", content },
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      generationRef.current = null;
      cancelledRef.current = false;
      setError(null);
      setStreaming(true);

      try {
        const result = await streamChat(
          info,
          history,
          {
            onStart: (id) => {
              generationRef.current = id;
            },
            onToken: (token) => {
              patchEntry(assistantId, (entry) => ({ ...entry, content: entry.content + token }));
            },
          },
          controller.signal,
        );
        if (result.reason === "cancelled") {
          patchEntry(assistantId, (entry) => ({ ...entry, interrupted: true }));
        }
      } catch (err) {
        if (cancelledRef.current || isAbortError(err)) {
          patchEntry(assistantId, (entry) => ({ ...entry, interrupted: true }));
        } else {
          patchEntry(assistantId, (entry) => ({ ...entry, failed: true }));
          setError(describe(err));
        }
      } finally {
        abortRef.current = null;
        generationRef.current = null;
        setStreaming(false);
      }
    },
    [info, patchEntry, update],
  );

  const cancel = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    cancelledRef.current = true;
    const generationId = generationRef.current;
    if (info && generationId) {
      // Cancelamento explícito; abortar a conexão em seguida garante a parada local.
      cancelChat(info, generationId).catch(() => undefined);
    }
    controller.abort();
  }, [info]);

  return { entries, streaming, error, send, cancel };
}
