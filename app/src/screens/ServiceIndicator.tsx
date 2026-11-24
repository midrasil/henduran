import type { BackendStatus } from "../hooks/useBackend";
import type { EngineStatus } from "../api/engine";
import { modelReady } from "./journey/JourneyTopBar";

import "./ServiceIndicator.css";

type Light = "ok" | "busy" | "off";

export interface ServiceIndicatorState {
  light: Light;
  main: string;
  detail: string;
}

export interface ServiceIndicatorProps {
  backend: BackendStatus;
  engine: EngineStatus | null;
  onModels: () => void;
  /** O menu anuncia o estado; no assistente isso competiria com o aviso do Narrador. */
  announce?: boolean;
  className?: string;
}

/** Luz e textos do indicador: serviço, depois o modelo (o texto não depende só da cor). */
export function serviceState(backend: BackendStatus, engine: EngineStatus | null): ServiceIndicatorState {
  if (backend.kind === "starting") return { light: "busy", main: "Iniciando o serviço", detail: "aguarde" };
  if (backend.kind === "error") return { light: "off", main: `Erro: ${backend.message}`, detail: "o serviço local não respondeu" };
  if (engine === null) return { light: "busy", main: "Conectado", detail: "consultando o modelo…" };
  if (modelReady(engine)) {
    const name = engine.active_model_name ?? (engine.provider !== "local" ? `provedor ${engine.provider}` : "modelo");
    return { light: "ok", main: "Conectado", detail: `${name} pronto` };
  }
  if (engine.state === "starting") return { light: "busy", main: "Conectado", detail: "carregando o modelo…" };
  if (engine.state === "downloading") return { light: "busy", main: "Conectado", detail: "baixando o motor de IA…" };
  return { light: "off", main: "Conectado", detail: "nenhum modelo carregado" };
}

/** Indicador do serviço/modelo do rodapé; o clique abre a tela Modelos. */
export function ServiceIndicator({ backend, engine, onModels, announce = true, className }: ServiceIndicatorProps) {
  const { light, main, detail } = serviceState(backend, engine);
  return (
    <div className={className ? `service-indicator ${className}` : "service-indicator"} {...(announce ? { role: "status" } : {})}>
      <button
        type="button"
        className="service-indicator__btn"
        data-light={light}
        onClick={onModels}
        aria-label={`${main}, ${detail}. Abrir Modelos`}
      >
        <span className="service-indicator__led" aria-hidden="true" />
        <span>{main}</span>
        <span className="service-indicator__sep" aria-hidden="true">
          ·
        </span>
        <small className="service-indicator__detail">{detail}</small>
        <span className="service-indicator__sep" aria-hidden="true">
          ·
        </span>
        <span className="service-indicator__go" aria-hidden="true">
          Modelos ▸
        </span>
      </button>
    </div>
  );
}
