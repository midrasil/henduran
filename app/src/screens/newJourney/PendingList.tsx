import type { FieldError } from "../../api/backend";
import { Button } from "../../ui";
import { focusFirstError } from "./model";

/**
 * Lista das pendências de um passo, mostrada depois de uma tentativa de avançar.
 * Cada item leva o foco ao campo correspondente.
 */
export function PendingList({
  prefix,
  errors,
  title = "Antes de avançar, resolva:",
  labelFor,
}: {
  prefix: string;
  errors: FieldError[];
  title?: string;
  /** Rótulo curto do campo, para distinguir mensagens iguais (por exemplo, "Convicção 2"). */
  labelFor?: (field: string) => string | null;
}) {
  if (errors.length === 0) return null;
  return (
    <section className="pending surface-parchment px-frame" aria-labelledby={`${prefix}-pending-title`}>
      <h4 id={`${prefix}-pending-title`} className="pending__title">
        {title}
      </h4>
      <ul className="pending__list">
        {errors.map((e, i) => (
          <li key={`${e.field}-${e.code}-${i}`}>
            <Button variant="ghost" size="sm" className="pending__link" onClick={() => focusFirstError(prefix, [e])}>
              {labelFor?.(e.field) ? `${labelFor(e.field)}: ${e.message}` : e.message}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
