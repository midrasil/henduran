import { useId, type ReactNode, type Ref } from "react";

import "./FieldGroup.css";

export interface FieldGroupProps {
  /** Título do grupo (vira a legenda do `fieldset`). */
  legend: ReactNode;
  /** Explicação curta, sempre visível. */
  hint?: ReactNode;
  /** Erro do grupo inteiro (por exemplo, uma distribuição inválida). */
  error?: ReactNode;
  /** Conteúdo à direita da legenda (por exemplo, um botão). */
  extra?: ReactNode;
  /** Ref da legenda visível (para levar o foco ao grupo). */
  legendRef?: Ref<HTMLSpanElement>;
  /** Id da legenda visível; com ele (ou com a ref) a legenda recebe foco programático. */
  legendId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Grupo de campos relacionados (`fieldset` + `legend`), com dica e erro ligados
 * ao grupo por `aria-describedby`. A legenda pode receber foco programático.
 */
export function FieldGroup({ legend, hint, error, extra, legendRef, legendId, className, children }: FieldGroupProps) {
  const ids = useId();
  const hintId = hint ? `${ids}-hint` : undefined;
  const errorId = error ? `${ids}-error` : undefined;
  return (
    <fieldset
      className={["field-group", error ? "field-group--invalid" : "", className ?? ""].filter(Boolean).join(" ")}
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
    >
      <legend className="field-group__legend">
        <span
          ref={legendRef}
          id={legendId}
          tabIndex={legendRef || legendId ? -1 : undefined}
          className="field-group__title"
        >
          {legend}
        </span>
      </legend>
      {extra ? <div className="field-group__extra">{extra}</div> : null}
      {hint ? (
        <div id={hintId} className="field-group__hint">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="field-group__error">
          {error}
        </p>
      ) : null}
      <div className="field-group__body">{children}</div>
    </fieldset>
  );
}
