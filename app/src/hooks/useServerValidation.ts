import { useCallback, useEffect, useRef, useState } from "react";

import { describeError } from "../lib/format";

/** Atraso padrão da validação ao vivo, em ms. */
export const VALIDATION_DELAY_MS = 350;

interface State<T, R> {
  result: R | null;
  /** Valor ao qual `result` corresponde. */
  forValue: T | null;
  error: string | null;
}

/**
 * Validação no servidor com atraso curto: chama `run` alguns ms depois da última
 * mudança de `value` (o objeto muda de identidade a cada edição). Respostas
 * antigas que chegam depois de uma nova são descartadas. `validateNow` valida o
 * valor mais recente na hora (por exemplo, ao tentar avançar) e devolve o resultado.
 */
export function useServerValidation<T, R>(value: T | null, run: (value: T) => Promise<R>, delayMs = VALIDATION_DELAY_MS) {
  const [state, setState] = useState<State<T, R>>({ result: null, forValue: null, error: null });
  const latest = useRef(value);
  latest.current = value;
  const runRef = useRef(run);
  runRef.current = run;
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const validateNow = useCallback(async (): Promise<R | null> => {
    const current = latest.current;
    if (current === null) return null;
    const id = ++seq.current;
    try {
      const result = await runRef.current(current);
      if (alive.current && id === seq.current) setState({ result, forValue: current, error: null });
      return result;
    } catch (err) {
      if (alive.current && id === seq.current) {
        setState((prev) => ({ ...prev, error: describeError(err, "Não foi possível validar agora.") }));
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (value === null) return;
    const timer = setTimeout(() => void validateNow(), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, validateNow]);

  return {
    result: state.result,
    /** Há edição ainda não validada. */
    pending: value !== null && state.forValue !== value,
    error: state.error,
    validateNow,
  };
}
