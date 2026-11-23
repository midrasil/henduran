import { useId, type ComponentPropsWithRef } from "react";

import { describedBy, Field, type FieldExtras } from "../TextField/TextField";

import "../TextField/TextField.css";
import "./Select.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = FieldExtras &
  Omit<ComponentPropsWithRef<"select">, "className" | "children"> & {
    options: SelectOption[];
    /** Primeira opção vazia (valor `""`), por exemplo "Escolha…". */
    placeholder?: string;
  };

/**
 * Lista de seleção nativa com rótulo, dica e erro (o teclado e o leitor de tela
 * são os do sistema). A seta é desenhada em CSS, sem imagem.
 */
export function Select({ label, hint, error, hideLabel, action, className, id, options, placeholder, ...select }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      action={action}
      className={["field--select", className ?? ""].filter(Boolean).join(" ")}
    >
      <span className="select">
        <select
          id={fieldId}
          className="field__control select__control px-frame"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint !== undefined && `${fieldId}-hint`, error !== undefined && `${fieldId}-error`)}
          {...select}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="select__arrow" aria-hidden="true" />
      </span>
    </Field>
  );
}
