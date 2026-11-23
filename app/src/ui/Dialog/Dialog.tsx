import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import "./Dialog.css";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  /** Chamado com Esc e pelos botões de fechar do consumidor. */
  onClose: () => void;
  /** Texto principal; vira a descrição acessível do diálogo. */
  description?: ReactNode;
  /** Botões do rodapé. */
  actions?: ReactNode;
  /** Elemento que recebe o foco ao abrir (padrão: o primeiro focável). Em confirmações destrutivas, use o Cancelar. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Para onde o foco volta se o elemento que abriu o diálogo sumiu. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Impede fechar com Esc (por exemplo, enquanto uma operação termina). */
  dismissible?: boolean;
  tone?: "default" | "danger";
  /** `wide` para conteúdos grandes (ficha completa, recorte do retrato). */
  size?: "default" | "wide";
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal (`role="dialog"`, `aria-modal`): prende o foco, fecha com Esc,
 * torna o resto da página inerte e devolve o foco a quem o abriu.
 */
export function Dialog({
  open,
  title,
  onClose,
  description,
  actions,
  initialFocusRef,
  returnFocusRef,
  dismissible = true,
  tone = "default",
  size = "default",
  children,
}: DialogProps) {
  const ids = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const host = hostRef.current;

    // O resto da página fica inerte (sem foco nem leitura) enquanto o diálogo está aberto.
    const madeInert: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement && child !== host && !child.inert) {
        child.inert = true;
        madeInert.push(child);
      }
    }

    const box = boxRef.current;
    const target = initialFocusRef?.current ?? box?.querySelector<HTMLElement>(FOCUSABLE) ?? box;
    target?.focus();

    return () => {
      for (const el of madeInert) el.inert = false;
      const back = previous?.isConnected ? previous : returnFocusRef?.current;
      back?.focus();
    };
    // Só ao abrir e fechar; as refs são estáveis.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (dismissible) {
        event.stopPropagation();
        onClose();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const box = boxRef.current;
    if (!box) return;
    const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === box)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div ref={hostRef} className="dialog-layer">
      <div className="dialog-backdrop" aria-hidden="true" />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={description ? `${ids}-desc` : undefined}
        tabIndex={-1}
        className={`dialog dialog--${tone}${size === "wide" ? " dialog--wide" : ""} surface-dark px-frame`}
        onKeyDown={onKeyDown}
      >
        <div className="dialog__titlebar">
          <h2 id={`${ids}-title`} className="dialog__title">
            {title}
          </h2>
        </div>
        <div className="dialog__body">
          {description ? (
            <div id={`${ids}-desc`} className="dialog__description">
              {description}
            </div>
          ) : null}
          {children}
        </div>
        {actions ? <div className="dialog__actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
