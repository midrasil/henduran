import type { ReactNode } from "react";

import "./Badge.css";

export type BadgeTone = "neutral" | "accent" | "success" | "warn" | "danger" | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Etiqueta curta (estado, categoria). A cor nunca é a única informação: o texto diz o estado. */
export function Badge({ tone = "neutral", icon, className, children }: BadgeProps) {
  return (
    <span className={["badge", `badge--${tone}`, className ?? ""].filter(Boolean).join(" ")}>
      {icon ? (
        <span className="badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
