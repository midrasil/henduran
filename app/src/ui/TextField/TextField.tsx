import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import "./TextField.css";

export interface FieldExtras {
  label: ReactNode;
  /** Dica sempre visível abaixo do campo. */
  hint?: ReactNode;
  /** Mensagem de erro; marca o campo como inválido. */
  error?: ReactNode;
  /** Esconde o rótulo visualmente (continua acessível). */
  hideLabel?: boolean;
  /** Elemento ao lado do campo (por exemplo, o botão Buscar). */
  action?: ReactNode;
  className?: string;
}

/** Junta os ids não vazios para `aria-describedby`. */
export function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter(Boolean).join(" ");
  return list || undefined;
}

/** Moldura comum dos campos (rótulo, linha do controle, dica e erro); usada também pelo `Select`. */
export function Field({
  id,
  label,
  hint,
  error,
  hideLabel,
  action,
  className,
  children,
}: { [K in keyof FieldExtras]?: FieldExtras[K] | undefined } & { id: string; children: ReactNode }) {
  return (
    <div className={["field", error ? "field--invalid" : "", className ?? ""].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : "field__label"}>
        {label}
      </label>
      <div className="field__row">
        {children}
        {action}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = FieldExtras & Omit<ComponentPropsWithRef<"input">, "className">;

/** Campo de texto de uma linha com rótulo, dica e erro. */
export function TextField({ label, hint, error, hideLabel, action, className, id, ...input }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} hideLabel={hideLabel} action={action} className={className}>
      <input
        id={fieldId}
        className="field__control px-frame"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint !== undefined && `${fieldId}-hint`, error !== undefined && `${fieldId}-error`)}
        {...input}
      />
    </Field>
  );
}

export type TextAreaProps = FieldExtras & Omit<ComponentPropsWithRef<"textarea">, "className">;

/** Área de texto com rótulo, dica e erro. */
export function TextArea({ label, hint, error, hideLabel, action, className, id, ...area }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} hideLabel={hideLabel} action={action} className={className}>
      <textarea
        id={fieldId}
        className="field__control field__control--area px-frame"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint !== undefined && `${fieldId}-hint`, error !== undefined && `${fieldId}-error`)}
        {...area}
      />
    </Field>
  );
}
