import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type KeyboardEvent } from "react";

import { PixelIcon } from "../icons";

import "./Composer.css";

export interface ComposerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter ou o ícone de enviar. */
  onSubmit: () => void;
  /** Durante a resposta, o ícone vira parar. */
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Rótulo acessível do campo. */
  label: string;
  /** Dica abaixo do campo (padrão: os atalhos). */
  hint?: string | null;
  /** Altura máxima em px antes de rolar (padrão 190). */
  maxHeight?: number;
  className?: string;
}

export const COMPOSER_MAX_HEIGHT = 190;

/** Ajusta a altura do campo ao texto, até `max` (depois rola). Por CSSOM, permitido pela CSP. */
export function growTextArea(el: HTMLTextAreaElement, max = COMPOSER_MAX_HEIGHT): number {
  el.style.setProperty("height", "auto");
  const height = Math.min(el.scrollHeight, max);
  if (height > 0) el.style.setProperty("height", `${height}px`);
  else el.style.removeProperty("height");
  el.style.setProperty("overflow-y", el.scrollHeight > max ? "auto" : "hidden");
  return height;
}

/**
 * Campo de escrita do chat: começa com uma linha e cresce com o texto ou com
 * Shift+Enter, até um limite, e depois rola. Enter envia. O envio é um ícone
 * dentro do campo, que vira parar durante a resposta.
 */
export const Composer = forwardRef<HTMLTextAreaElement | null, ComposerProps>(function Composer(
  { id, value, onChange, onSubmit, onStop, streaming = false, disabled = false, placeholder, label, hint, maxHeight = COMPOSER_MAX_HEIGHT, className },
  forwarded,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwarded, () => ref.current as HTMLTextAreaElement);

  useLayoutEffect(() => {
    if (ref.current) growTextArea(ref.current, maxHeight);
  }, [value, maxHeight]);

  const canSend = !disabled && !streaming && value.trim().length > 0;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  const hintText = hint === undefined ? (disabled ? "" : "Enter envia · Shift+Enter pula linha") : hint;
  const hintId = `${id}-hint`;

  return (
    <div className={["composer", disabled ? "composer--off" : "", className ?? ""].filter(Boolean).join(" ")}>
      <div className="composer__field">
        <textarea
          id={id}
          ref={ref}
          rows={1}
          className="composer__input"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={hintText ? hintId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {streaming ? (
          <button type="button" className="composer__send" aria-label="Parar" data-tip="Parar" onClick={onStop}>
            <PixelIcon name="stop" />
          </button>
        ) : (
          <button type="button" className="composer__send" aria-label="Enviar" data-tip="Enviar" disabled={!canSend} onClick={onSubmit}>
            <PixelIcon name="send" />
          </button>
        )}
      </div>
      {hintText ? (
        <p id={hintId} className="composer__hint">
          {hintText}
        </p>
      ) : null}
    </div>
  );
});
