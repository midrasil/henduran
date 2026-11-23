import { useLayoutEffect, useRef } from "react";

import "./ProgressBar.css";

export interface ProgressBarProps {
  /** Fração de 0 a 1; `null` para progresso indeterminado. */
  value: number | null;
  /** Rótulo acessível (use este ou `labelledBy`). */
  label?: string;
  labelledBy?: string;
  /** Texto do valor para leitores de tela; padrão: a porcentagem. */
  valueText?: string;
  tone?: "gold" | "purple";
  className?: string;
}

/**
 * Barra de progresso em segmentos (`role="progressbar"`). A largura vai por uma
 * custom property definida via CSSOM, o que a CSP (`style-src 'self'`) permite.
 */
export function ProgressBar({ value, label, labelledBy, valueText, tone = "gold", className }: ProgressBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const clamped = value === null ? null : Math.min(1, Math.max(0, value));
  const percent = clamped === null ? null : Math.round(clamped * 100);

  useLayoutEffect(() => {
    fillRef.current?.style.setProperty("--progress", String(clamped ?? 0));
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={percent === null ? valueText : (valueText ?? `${percent}%`)}
      className={[
        "progress",
        `progress--${tone}`,
        clamped === null ? "progress--indeterminate" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={fillRef} className="progress__fill" />
    </div>
  );
}
