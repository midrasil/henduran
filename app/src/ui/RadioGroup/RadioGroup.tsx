import { useId, type ReactNode, type Ref } from "react";

import "./RadioGroup.css";

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Texto de apoio abaixo do rótulo (vira a descrição acessível da opção). */
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string> {
  legend: ReactNode;
  options: RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Nome do grupo (padrão: gerado). */
  name?: string;
  hint?: ReactNode;
  /** Erro do grupo; fica na descrição do grupo e da opção marcada. */
  error?: ReactNode;
  /** `cards`: opções em caixas com moldura (escolha de perfil, de lugar); `list` (padrão): compacta. */
  appearance?: "list" | "cards";
  hideLegend?: boolean;
  disabled?: boolean;
  /** Ref do primeiro botão de opção (para levar o foco ao grupo). */
  firstInputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  className?: string;
}

/**
 * Grupo de opções exclusivas com botões de opção nativos: setas movem e marcam,
 * Tab entra e sai do grupo. Cada opção tem alvo de 44 px.
 */
export function RadioGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  name,
  hint,
  error,
  appearance = "list",
  hideLegend = false,
  disabled = false,
  firstInputRef,
  onBlur,
  className,
}: RadioGroupProps<T>) {
  const ids = useId();
  const groupName = name ?? `${ids}-radio`;
  const hintId = hint ? `${ids}-hint` : undefined;
  const errorId = error ? `${ids}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset
      className={["radio-group", `radio-group--${appearance}`, error ? "radio-group--invalid" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-describedby={describedBy}
      disabled={disabled}
    >
      <legend className={hideLegend ? "visually-hidden" : "radio-group__legend"}>{legend}</legend>
      {hint ? (
        <p id={hintId} className="radio-group__hint">
          {hint}
        </p>
      ) : null}
      <div className="radio-group__options">
        {options.map((option, index) => {
          const optionId = `${ids}-${index}`;
          const descId = option.description ? `${optionId}-desc` : undefined;
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={[
                "radio-group__option",
                appearance === "cards" ? "px-frame" : "",
                checked ? "radio-group__option--checked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                ref={index === 0 ? firstInputRef : undefined}
                id={optionId}
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                aria-labelledby={`${optionId}-label`}
                aria-describedby={[descId, checked ? errorId : undefined].filter(Boolean).join(" ") || undefined}
                onChange={() => onChange(option.value)}
                onBlur={onBlur}
              />
              <span className="radio-group__text">
                <span id={`${optionId}-label`} className="radio-group__label">
                  {option.label}
                </span>
                {option.description ? (
                  <span id={descId} className="radio-group__desc">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="radio-group__error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
