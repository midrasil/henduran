import { useCallback, useEffect, useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import {
  fetchCreationRules,
  fetchWorldSchema,
  listJourneys,
  type CreationRules,
  type JourneyList,
  type WorldSchema,
} from "../api/journeys";
import { describeError } from "../lib/format";

export interface RulesState {
  rules: CreationRules | null;
  schema: WorldSchema | null;
  error: string | null;
  reload: () => void;
}

/** Catálogo de criação (`/rules/creation`) e limites do Mundo (`/worlds/schema`), lidos uma vez por conexão. */
export function useCreationRules(info: BackendInfo | null): RulesState {
  const [rules, setRules] = useState<CreationRules | null>(null);
  const [schema, setSchema] = useState<WorldSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!info) return;
    let active = true;
    setError(null);
    Promise.all([fetchCreationRules(info), fetchWorldSchema(info)])
      .then(([r, s]) => {
        if (!active) return;
        setRules(r);
        setSchema(s);
      })
      .catch((err: unknown) => {
        if (active) setError(describeError(err, "Não foi possível carregar as regras."));
      });
    return () => {
      active = false;
    };
  }, [info, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { rules, schema, error, reload };
}

export interface JourneyListState {
  data: JourneyList | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<JourneyList | null>;
}

/** Lista de Jornadas (`GET /journeys`), recarregada sob pedido. */
export function useJourneyList(info: BackendInfo | null): JourneyListState {
  const [data, setData] = useState<JourneyList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async (): Promise<JourneyList | null> => {
    if (!info) return null;
    const id = ++seq.current;
    setLoading(true);
    try {
      const next = await listJourneys(info);
      if (id === seq.current) {
        setData(next);
        setError(null);
      }
      return next;
    } catch (err) {
      if (id === seq.current) setError(describeError(err, "Não foi possível listar as Jornadas."));
      return null;
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [info]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
