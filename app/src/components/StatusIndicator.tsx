import type { BackendStatus } from "../hooks/useBackend";
import { StatusIndicator as UiStatusIndicator, type StatusTone } from "../ui";

export function statusLabel(status: BackendStatus): string {
  switch (status.kind) {
    case "starting":
      return "Iniciando serviço…";
    case "connected":
      return "Conectado";
    case "error":
      return `Erro: ${status.message}`;
  }
}

const TONE: Record<BackendStatus["kind"], StatusTone> = {
  starting: "busy",
  connected: "ok",
  error: "error",
};

/** Indicador do estado do serviço local. O texto não depende só da cor. */
export function StatusIndicator({ status }: { status: BackendStatus }) {
  return <UiStatusIndicator tone={TONE[status.kind]} label={statusLabel(status)} role="status" />;
}
