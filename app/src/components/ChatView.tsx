import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import type { ChatEntry } from "../hooks/useChat";
import { Button, ChatBubble, TextArea } from "../ui";

export interface ChatViewProps {
  entries: ChatEntry[];
  streaming: boolean;
  error: string | null;
  disabled: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  /** Aviso exibido acima da conversa (por exemplo, motor de IA não pronto). */
  notice?: ReactNode;
}

const SPEAKER: Record<ChatEntry["role"], string> = {
  user: "Você",
  assistant: "Narrador",
};

/**
 * O que anunciar ao leitor de tela quando a resposta termina. A conversa em si
 * (`role="log"`) não é anunciada palavra por palavra: só o início e a resposta inteira.
 */
function finishedAnnouncement(entries: ChatEntry[]): string {
  const last = [...entries].reverse().find((entry) => entry.role === "assistant");
  if (!last) return "";
  // Falha: o alerta de erro já é anunciado.
  if (last.failed) return "";
  if (last.interrupted) return `Resposta interrompida. Narrador: ${last.content}`;
  return `Narrador: ${last.content}`;
}

export function ChatView({ entries, streaming, error, disabled, onSend, onCancel, notice }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasStreaming = useRef(streaming);

  // Mantém a última mensagem visível durante o streaming.
  useEffect(() => {
    const log = logRef.current;
    if (log && typeof log.scrollTo === "function") {
      log.scrollTo({ top: log.scrollHeight });
    }
  }, [entries]);

  // Anuncia o começo e o fim da resposta, nunca cada palavra.
  useEffect(() => {
    if (!wasStreaming.current && streaming) setAnnouncement("O Narrador está respondendo…");
    if (wasStreaming.current && !streaming) setAnnouncement(finishedAnnouncement(entries));
    wasStreaming.current = streaming;
  }, [streaming, entries]);

  const canSend = !disabled && !streaming && draft.trim().length > 0;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    onSend(draft);
    setDraft("");
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra a linha.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const lastId = entries[entries.length - 1]?.id;

  return (
    <section className="chat" aria-label="Chat com o Narrador">
      {notice}
      <div
        ref={logRef}
        className="chat__log px-frame"
        role="log"
        aria-live="off"
        aria-label="Conversa"
        aria-busy={streaming}
        tabIndex={0}
      >
        {entries.length === 0 ? (
          <p className="chat__empty">Escreva algo para começar a conversa com o Narrador.</p>
        ) : (
          <ol className="chat__list">
            {entries.map((entry) => (
              <li key={entry.id} className={`chat__item chat__item--${entry.role}`}>
                <ChatBubble
                  variant={entry.role === "user" ? "player" : "narrator"}
                  speaker={SPEAKER[entry.role]}
                  streaming={streaming && entry.id === lastId && entry.role === "assistant" && !entry.failed}
                  notes={
                    <>
                      {entry.interrupted ? <p className="bubble__note">Resposta interrompida.</p> : null}
                      {entry.failed ? <p className="bubble__note">Resposta não concluída.</p> : null}
                    </>
                  }
                >
                  {entry.content}
                </ChatBubble>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite" data-testid="chat-live">
        {announcement}
      </p>

      {error ? (
        <p className="callout callout--danger" role="alert">
          Erro: {error}
        </p>
      ) : null}

      <form className="chat__form" onSubmit={submit}>
        <TextArea
          id="chat-input"
          ref={inputRef}
          label="Mensagem para o Narrador"
          hint="Enter envia; Shift+Enter quebra a linha."
          rows={3}
          value={draft}
          disabled={disabled}
          placeholder="Descreva sua ação ou fale com o Narrador…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          action={
            <div className="chat__actions">
              <Button type="submit" variant="primary" disabled={!canSend}>
                Enviar
              </Button>
              {streaming ? (
                <Button variant="secondary" onClick={onCancel}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          }
        />
      </form>
    </section>
  );
}
