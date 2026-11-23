import { useRef, type KeyboardEvent, type ReactNode } from "react";

import "./Tabs.css";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Rótulo acessível da lista de abas. */
  label: string;
  /** Prefixo dos ids: a aba é `${idPrefix}-tab-${id}` e o painel, `${idPrefix}-panel-${id}`. */
  idPrefix: string;
  /** `vertical` usa as setas para cima e para baixo (abas laterais). */
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const tabPanelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * Lista de abas WAI-ARIA com ativação automática: setas esquerda e direita,
 * Home e End movem o foco e selecionam. Só a aba ativa entra na tabulação.
 */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, orientation = "horizontal", className }: TabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement | null>());

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = items.findIndex((t) => t.id === value);
    let next: number | null = null;
    const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    if (event.key === forward) next = (index + 1) % items.length;
    else if (event.key === backward) next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    const target = next === null ? undefined : items[next];
    if (!target) return;
    event.preventDefault();
    onChange(target.id);
    refs.current.get(target.id)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      className={["tabs", orientation === "vertical" ? "tabs--vertical" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      {items.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current.set(t.id, el);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, t.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, t.id)}
            tabIndex={selected ? 0 : -1}
            className={`tabs__tab px-frame${selected ? " tabs__tab--active" : ""}`}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.icon ? <span className="tabs__icon">{t.icon}</span> : null}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  id: string;
  selected: boolean;
  className?: string;
  children?: ReactNode;
}

/** Painel de uma aba, rotulado pela aba correspondente. */
export function TabPanel({ idPrefix, id, selected, className, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      hidden={!selected}
      className={className}
    >
      {children}
    </div>
  );
}
