import { useCallback, useEffect, useRef, useState } from "react";

import { BackendError, type BackendInfo } from "../api/backend";
import { cancelChat, chatErrorMessage, ENGINE_ERROR_CODES, isAbortError, StreamError } from "../api/chatStream";
import {
  closeScene as closeSceneRequest,
  declineProposal,
  fetchArcs,
  fetchHistory,
  renameScene as renameSceneRequest,
  rerollProposal,
  streamAcceptProposal,
  streamContinue,
  streamOpening,
  streamRegenerate,
  streamSend,
  type Arc,
  type HistoryView,
  type JourneyMessage,
  type NarrationDone,
  type NarrationHandlers,
} from "../api/journeyScreen";
import type { CurrentPlace, JourneySnapshot, MessageChannel, SceneView } from "../api/journeys";
import { describeError } from "../lib/format";

export type StreamKind = "opening" | "send" | "regenerate" | "continue" | "accept";

/** Resposta em andamento, mostrada por cima do histórico gravado até o `done`. */
export interface LiveStream {
  kind: StreamKind;
  /** Canal onde o texto aparece. */
  channel: MessageChannel;
  text: string;
  /** Regenerar e continuar: a mensagem do Narrador que é substituída ou continuada. */
  targetId: number | null;
  /** Envio: a fala do jogador, mostrada antes de o serviço confirmar. */
  userText: string | null;
  /** Abertura e aceite: a Cena proposta e validada pelo motor (evento `scene`). */
  scene: SceneView | null;
}

export type BusyAction = "close" | "reroll" | "decline";

export interface SessionError {
  message: string;
  code: string | null;
}

/** Mensagem do fim de uma resposta, para o anúncio ao leitor de tela. */
export interface FinishedReply {
  channel: MessageChannel;
  text: string;
  interrupted: boolean;
}

export interface UseJourneySessionOptions {
  /** Chamado quando a geração falha porque o motor ou o modelo não estão prontos. */
  onEngineProblem?: (code: string) => void;
}

const FALLBACK = "Não foi possível obter a resposta do Narrador.";

function toSessionError(err: unknown): SessionError {
  const code = err instanceof StreamError || err instanceof BackendError ? (err.code ?? null) : null;
  return { message: chatErrorMessage(code ?? undefined, describeError(err, FALLBACK)), code };
}

/**
 * Estado da Jornada aberta na tela: histórico gravado (`/messages`), arcos,
 * proposta pendente e a resposta em andamento. Toda mudança de estado vem do
 * serviço; depois de cada operação, a tela relê o histórico e os arcos.
 */
export function useJourneySession(info: BackendInfo | null, snapshot: JourneySnapshot, { onEngineProblem }: UseJourneySessionOptions = {}) {
  const [history, setHistory] = useState<HistoryView | null>(null);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStream | null>(null);
  const [error, setError] = useState<SessionError | null>(null);
  const [proposalNotice, setProposalNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [currentPlace, setCurrentPlace] = useState<CurrentPlace | null>(snapshot.current_place ?? null);
  const [finished, setFinished] = useState<FinishedReply | null>(null);
  /** Muda a cada operação concluída (o Log relê os eventos). */
  const [revision, setRevision] = useState(0);

  const engineProblemRef = useRef(onEngineProblem);
  engineProblemRef.current = onEngineProblem;
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const liveRef = useRef<LiveStream | null>(null);
  const mounted = useRef(true);

  const updateLive = useCallback((fn: (prev: LiveStream | null) => LiveStream | null) => {
    setLive((prev) => {
      const next = fn(prev);
      liveRef.current = next;
      return next;
    });
  }, []);

  /** Lê o histórico e os arcos; quem chama aplica junto com as outras mudanças (um só render). */
  const load = useCallback(async (): Promise<{ history: HistoryView; arcs: Arc[] } | null> => {
    if (!info) return null;
    try {
      const [h, a] = await Promise.all([fetchHistory(info), fetchArcs(info)]);
      return { history: h, arcs: a.arcs };
    } catch (err) {
      if (mounted.current) setLoadError(describeError(err, "Não foi possível carregar a Jornada."));
      return null;
    }
  }, [info]);

  const apply = useCallback((data: { history: HistoryView; arcs: Arc[] } | null) => {
    if (!data || !mounted.current) return;
    setHistory(data.history);
    setArcs(data.arcs);
    setLoadError(null);
  }, []);

  const reload = useCallback(async () => apply(await load()), [apply, load]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, [reload]);

  const run = useCallback(
    async (start: LiveStream, call: (handlers: NarrationHandlers, signal: AbortSignal) => Promise<NarrationDone>) => {
      if (!info || abortRef.current) return null;
      const controller = new AbortController();
      abortRef.current = controller;
      generationRef.current = null;
      cancelledRef.current = false;
      setError(null);
      setProposalNotice(null);
      setFinished(null);
      updateLive(() => start);
      let result: NarrationDone | null = null;
      let interrupted = false;
      try {
        result = await call(
          {
            onStart: (id) => {
              generationRef.current = id;
            },
            onToken: (text) => updateLive((prev) => (prev ? { ...prev, text: prev.text + text } : prev)),
            onScene: (scene) => updateLive((prev) => (prev ? { ...prev, scene } : prev)),
            onProposal: (proposal) => setHistory((prev) => (prev ? { ...prev, proposal } : prev)),
            onProposalError: (_code, message) => setProposalNotice(`O Aduran tentou propor uma Cena, mas não conseguiu: ${message}`),
          },
          controller.signal,
        );
        interrupted = result.reason === "cancelled";
        if (result.current_place) setCurrentPlace(result.current_place);
      } catch (err) {
        if (cancelledRef.current || isAbortError(err)) {
          interrupted = true;
        } else {
          const e = toSessionError(err);
          setError(e);
          if (e.code && ENGINE_ERROR_CODES.has(e.code)) engineProblemRef.current?.(e.code);
        }
      } finally {
        const last = liveRef.current;
        abortRef.current = null;
        generationRef.current = null;
        const data = await load();
        if (mounted.current) {
          apply(data);
          updateLive(() => null);
          if (last && last.text) setFinished({ channel: last.channel, text: last.text, interrupted });
          setRevision((n) => n + 1);
        }
      }
      return result;
    },
    [info, load, apply, updateLive],
  );

  const cancel = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    cancelledRef.current = true;
    const id = generationRef.current;
    if (info && id) cancelChat(info, id).catch(() => undefined);
    controller.abort();
  }, [info]);

  const blank = (kind: StreamKind, channel: MessageChannel): LiveStream => ({
    kind,
    channel,
    text: "",
    targetId: null,
    userText: null,
    scene: null,
  });

  const generateOpening = useCallback(
    () => run(blank("opening", "cena"), (h, s) => (info ? streamOpening(info, h, s) : Promise.reject(new Error("sem serviço")))),
    [info, run],
  );

  const send = useCallback(
    (text: string, channel: MessageChannel) => {
      const content = text.trim();
      if (!content) return Promise.resolve(null);
      return run({ ...blank("send", channel), userText: content }, (h, s) =>
        info ? streamSend(info, content, channel, h, s) : Promise.reject(new Error("sem serviço")),
      );
    },
    [info, run],
  );

  const lastOf = useCallback(
    (channel: MessageChannel): JourneyMessage | undefined => {
      const list = (history?.messages ?? []).filter(
        (m) => m.channel === channel && (channel === "fora_de_cena" || m.scene_id === (history?.scene?.id ?? null)),
      );
      return list[list.length - 1];
    },
    [history],
  );

  const regenerate = useCallback(
    (channel: MessageChannel) =>
      run({ ...blank("regenerate", channel), targetId: lastOf(channel)?.id ?? null }, (h, s) =>
        info ? streamRegenerate(info, channel, h, s) : Promise.reject(new Error("sem serviço")),
      ),
    [info, lastOf, run],
  );

  const continueReply = useCallback(
    (channel: MessageChannel) =>
      run({ ...blank("continue", channel), targetId: lastOf(channel)?.id ?? null }, (h, s) =>
        info ? streamContinue(info, channel, h, s) : Promise.reject(new Error("sem serviço")),
      ),
    [info, lastOf, run],
  );

  const acceptProposal = useCallback(
    () => run(blank("accept", "cena"), (h, s) => (info ? streamAcceptProposal(info, h, s) : Promise.reject(new Error("sem serviço")))),
    [info, run],
  );

  /** Operações JSON curtas (encerrar, pedir outra, recusar): uma por vez, com o mesmo tratamento de erro. */
  const act = useCallback(
    async <T,>(kind: BusyAction, call: (info: BackendInfo) => Promise<T>): Promise<T | null> => {
      if (!info || abortRef.current) return null;
      setBusy(kind);
      setError(null);
      setProposalNotice(null);
      try {
        const out = await call(info);
        return out;
      } catch (err) {
        const e = toSessionError(err);
        setError(e);
        if (e.code && ENGINE_ERROR_CODES.has(e.code)) engineProblemRef.current?.(e.code);
        return null;
      } finally {
        const data = await load();
        if (mounted.current) {
          apply(data);
          setBusy(null);
          setRevision((n) => n + 1);
        }
      }
    },
    [info, load, apply],
  );

  const reroll = useCallback(() => act("reroll", rerollProposal), [act]);
  const decline = useCallback(() => act("decline", declineProposal), [act]);
  const closeScene = useCallback(() => act("close", closeSceneRequest), [act]);

  /** Renomeia uma Cena (aberta ou encerrada); o erro volta para o formulário. */
  const renameScene = useCallback(
    async (id: number, title: string): Promise<string | null> => {
      if (!info) return "Serviço indisponível.";
      try {
        await renameSceneRequest(info, id, title);
        await reload();
        setRevision((n) => n + 1);
        return null;
      } catch (err) {
        return describeError(err, "Não foi possível renomear a Cena.");
      }
    },
    [info, reload],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    history,
    arcs,
    loadError,
    live,
    streaming: live !== null,
    error,
    clearError,
    proposalNotice,
    busy,
    currentPlace,
    finished,
    revision,
    reload,
    generateOpening,
    send,
    regenerate,
    continueReply,
    acceptProposal,
    reroll,
    decline,
    closeScene,
    renameScene,
    cancel,
  };
}

export type JourneySession = ReturnType<typeof useJourneySession>;
