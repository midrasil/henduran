import type { ReactNode } from "react";

import "./Stepper.css";

export interface StepItem {
  id: string;
  label: ReactNode;
}

export interface StepperProps {
  steps: StepItem[];
  /** Índice do passo atual (0 em diante). */
  current: number;
  /** Rótulo da navegação (por exemplo, "Passos da Nova Jornada"). */
  label: string;
  /**
   * Com esta função, os passos **anteriores** ao atual viram botões para voltar
   * a eles. Os seguintes nunca são clicáveis: avança-se pelo botão Avançar.
   */
  onSelect?: (index: number) => void;
  className?: string;
}

/**
 * Lista ordenada dos passos de um assistente. O atual tem `aria-current="step"`;
 * o estado de cada passo também está em texto (não só na cor).
 */
export function Stepper({ steps, current, label, onSelect, className }: StepperProps) {
  return (
    <nav aria-label={label} className={["stepper", className ?? ""].filter(Boolean).join(" ")}>
      <ol className="stepper__list">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "current" : "next";
          const content = (
            <>
              <span className="stepper__number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="stepper__label">{step.label}</span>
              <span className="visually-hidden">
                {state === "done" ? " (concluído)" : state === "current" ? " (passo atual)" : ""}
              </span>
            </>
          );
          return (
            <li
              key={step.id}
              className={`stepper__item stepper__item--${state}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "done" && onSelect ? (
                <button type="button" className="stepper__box stepper__button px-frame" onClick={() => onSelect(index)}>
                  {content}
                </button>
              ) : (
                <span className="stepper__box px-frame">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
