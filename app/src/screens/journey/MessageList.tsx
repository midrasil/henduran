import { useEffect, useRef, type ReactNode } from "react";

import { PixelIcon, type PixelIconName } from "../../ui";

export interface ViewMessage {
  key: string;
  /** Id gravado (nulo nas que ainda estão chegando). */
  id: number | null;
  role: "narrador" | "jogador";
  content: string;
  /** Resposta interrompida (`cancelada`). */
  interrupted: boolean;
  /** Recebendo o texto agora. */
  streaming: boolean;
}

export interface MessageListProps {
  messages: ViewMessage[];
  /** Quem fala pelo Narrador: "Narrador" na Cena, "Aduran" na margem. */
  narratorName: string;
  playerName: string;
  /** Letra capitular na primeira narração (página da Cena). */
  capital?: boolean;
  /** Cena encerrada: só copiar. */
  readonly?: boolean;
  /** Há uma geração em curso (regenerar e continuar ficam indisponíveis). */
  busy?: boolean;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
  /** Conteúdo depois das mensagens (cartão de proposta, resumo). */
  footer?: ReactNode;
  empty?: ReactNode;
  label: string;
}

function paragraphs(text: string): string[] {
  const parts = text.split(/\n{2,}/).map((p) => p.trim());
  return parts.filter((p, i) => p.length > 0 || i === 0);
}

function ActionButton({ icon, label, onClick }: { icon: PixelIconName; label: string; onClick: () => void }) {
  return (
    <button type="button" className="msg__action" aria-label={label} data-tip={label} onClick={onClick}>
      <PixelIcon name={icon} />
    </button>
  );
}

/**
 * Mensagens do chat da Jornada. As ações (copiar, regenerar a última resposta
 * do Narrador, continuar a interrompida) só aparecem ao passar o mouse ou com
 * foco do teclado. A lista não é anunciada palavra por palavra (`aria-live="off"`).
 */
export function MessageList({
  messages,
  narratorName,
  playerName,
  capital = false,
  readonly = false,
  busy = false,
  onCopy,
  onRegenerate,
  onContinue,
  footer,
  empty,
  label,
}: MessageListProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const lastText = last?.content.length ?? 0;

  // Mantém a última mensagem visível enquanto o texto chega.
  useEffect(() => {
    const log = logRef.current;
    if (log && typeof log.scrollTo === "function") log.scrollTo({ top: log.scrollHeight });
  }, [messages.length, lastText, footer]);

  const firstNarrator = messages.findIndex((m) => m.role === "narrador");

  return (
    <div ref={logRef} className="msgs" role="log" aria-live="off" aria-label={label} aria-busy={busy} tabIndex={0}>
      {messages.length === 0 && empty ? <div className="msgs__empty">{empty}</div> : null}
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1;
        const narrator = m.role === "narrador";
        const canRedo = !readonly && !busy && narrator && isLast && m.id !== null;
        return (
          <article
            key={m.key}
            className={[
              "msg",
              narrator ? "msg--narrator" : "msg--player",
              capital && i === firstNarrator ? "msg--first" : "",
              m.interrupted ? "msg--cut" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${narrator ? narratorName : playerName}`}
          >
            {!m.streaming ? (
              <div className="msg__actions" role="group" aria-label="Ações da mensagem">
                <ActionButton icon="copy" label="Copiar" onClick={() => onCopy(m.content)} />
                {canRedo && onRegenerate ? <ActionButton icon="regen" label="Regenerar" onClick={onRegenerate} /> : null}
                {canRedo && m.interrupted && onContinue ? <ActionButton icon="resume" label="Continuar" onClick={onContinue} /> : null}
              </div>
            ) : null}
            <div className="msg__who">{narrator ? narratorName : playerName}</div>
            <div className={`msg__body${m.streaming ? " msg__body--typing" : ""}`}>
              {paragraphs(m.content).map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
            {m.interrupted ? <p className="msg__note">Resposta interrompida.</p> : null}
          </article>
        );
      })}
      {footer}
    </div>
  );
}
