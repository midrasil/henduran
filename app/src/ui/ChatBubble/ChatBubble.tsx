import type { ReactNode } from "react";

import "./ChatBubble.css";

export type ChatBubbleVariant = "narrator" | "player" | "system" | "aside";

export interface ChatBubbleProps {
  variant: ChatBubbleVariant;
  /** Quem fala (Narrador, Você, Aduran…). Omitido nas mensagens de sistema. */
  speaker?: ReactNode;
  /** Notas abaixo do texto (por exemplo, "Resposta interrompida."). */
  notes?: ReactNode;
  /** Mostra um cursor em bloco no fim do texto enquanto a resposta chega. */
  streaming?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Balão de chat. Variantes: `narrator` (pergaminho), `player`, `system` e
 * `aside` (borda pontilhada; reservado para o Narrador Geral `@Aduran`).
 */
export function ChatBubble({ variant, speaker, notes, streaming = false, className, children }: ChatBubbleProps) {
  const surface = variant === "narrator" ? "surface-parchment" : "surface-dark";
  return (
    <div className={["bubble", `bubble--${variant}`, surface, className ?? ""].filter(Boolean).join(" ")}>
      {speaker ? <span className="bubble__speaker">{speaker}</span> : null}
      <div className={`bubble__body${variant === "narrator" || variant === "player" ? " px-frame" : ""}`}>
        <p className="bubble__text">
          {children}
          {streaming ? <span className="bubble__caret" aria-hidden="true" /> : null}
        </p>
        {notes}
      </div>
    </div>
  );
}
