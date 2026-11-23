import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import type { ChatEntry } from "../hooks/useChat";

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

export function ChatView({ entries, streaming, error, disabled, onSend, onCancel, notice }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mantém a última mensagem visível durante o streaming.
  useEffect(() => {
    const log = logRef.current;
    if (log && typeof log.scrollTo === "function") {
      log.scrollTo({ top: log.scrollHeight });
    }
  }, [entries]);

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

  return (
    <section className="chat" aria-label="Chat com o Narrador">
      {notice}
      <div
        ref={logRef}
        className="chat__log"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversa"
        aria-busy={streaming}
        tabIndex={0}
      >
        {entries.length === 0 ? (
          <p className="chat__empty">Escreva algo para começar a conversa com o Narrador.</p>
        ) : (
          <ol className="chat__list">
            {entries.map((entry) => (
              <li key={entry.id} className={`message message--${entry.role}`}>
                <span className="message__speaker">{SPEAKER[entry.role]}</span>
                <p className="message__text">
                  {entry.content || (entry.role === "assistant" && streaming && !entry.failed ? "…" : "")}
                </p>
                {entry.interrupted ? <p className="message__note">Resposta interrompida.</p> : null}
                {entry.failed ? <p className="message__note">Resposta não concluída.</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      {error ? (
        <p className="chat__error" role="alert">
          Erro: {error}
        </p>
      ) : null}

      <form className="chat__form" onSubmit={submit}>
        <label className="chat__label" htmlFor="chat-input">
          Mensagem para o Narrador
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          className="chat__input"
          rows={3}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby="chat-hint"
        />
        <p id="chat-hint" className="chat__hint">
          Enter envia; Shift+Enter quebra a linha.
        </p>
        <div className="chat__actions">
          {streaming ? (
            <button type="button" className="button button--secondary" onClick={onCancel}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="button button--primary" disabled={!canSend}>
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
