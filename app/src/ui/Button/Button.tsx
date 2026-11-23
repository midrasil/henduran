import type { ComponentPropsWithRef } from "react";

import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  /** `md` (padrão) tem alvo de 44 px; `sm` tem 32 px, para ações secundárias densas. */
  size?: "md" | "sm";
  /** Desativa o botão, marca `aria-busy` e mostra um indicador; o rótulo continua o nome acessível. */
  loading?: boolean;
}

/** Botão com moldura em pixel. `type` padrão é `button`. */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, `btn--${size}`, variant === "ghost" ? "" : "px-frame", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : null}
      <span className="btn__label">{children}</span>
    </button>
  );
}
