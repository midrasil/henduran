import type { BackendStatus } from "../hooks/useBackend";

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

/** Indicador do estado do serviço local. O texto não depende só da cor. */
export function StatusIndicator({ status }: { status: BackendStatus }) {
  return (
    <p className={`status status--${status.kind}`} role="status">
      <span className="status__dot" aria-hidden="true" />
      {statusLabel(status)}
    </p>
  );
}
