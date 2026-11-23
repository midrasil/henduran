import { useEffect, useId, useRef, useState } from "react";

import { formatBytes } from "../api/engine";
import { ACTIVE_DOWNLOAD_STATES, DOWNLOAD_STATE_LABEL, type DownloadItem } from "../api/hub";

export interface DownloadsPanelProps {
  downloads: DownloadItem[];
  error: string | null;
  onCancel: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onForget: (id: string) => Promise<void>;
}

function speedLabel(bps: number): string {
  return bps > 0 ? `${formatBytes(bps)}/s` : "";
}

function bytesLabel(item: DownloadItem): string {
  if (item.total_bytes > 0) {
    const done = item.done_bytes > 0 ? formatBytes(item.done_bytes) : "0 MB";
    return `${done} de ${formatBytes(item.total_bytes)}`;
  }
  return item.done_bytes > 0 ? `${formatBytes(item.done_bytes)} baixados` : "";
}

/** Frase anunciada (uma vez) quando um download muda de estado; nunca a cada porcento. */
function announcement(item: DownloadItem): string | null {
  switch (item.state) {
    case "done":
      return item.verified
        ? `${item.name}: download concluído e SHA-256 conferido.`
        : `${item.name}: download concluído sem verificação de integridade.`;
    case "error":
      return `${item.name}: erro no download. ${item.error?.message ?? ""}`.trim();
    case "cancelled":
      return `${item.name}: download cancelado.`;
    case "verifying":
      return `${item.name}: conferindo o SHA-256.`;
    case "downloading":
      return `${item.name}: download iniciado.`;
    default:
      return null;
  }
}

export function DownloadsPanel({ downloads, error, onCancel, onRetry, onForget }: DownloadsPanelProps) {
  const ids = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const seen = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const messages: string[] = [];
    for (const item of downloads) {
      if (seen.current.get(item.id) !== item.state) {
        const text = seen.current.has(item.id) || item.state !== "done" ? announcement(item) : null;
        if (text) messages.push(text);
        seen.current.set(item.id, item.state);
      }
    }
    if (messages.length) setLive(messages.join(" "));
  }, [downloads]);

  const run = async (id: string, action: (id: string) => Promise<void>) => {
    setBusy(id);
    setActionError(null);
    try {
      await action(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "falha desconhecida");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel" aria-labelledby={`${ids}-title`}>
      <h3 id={`${ids}-title`}>Downloads</h3>
      <p className="visually-hidden" aria-live="polite" data-testid="downloads-live">
        {live}
      </p>
      {error ? <p className="panel__error">Não foi possível consultar os downloads: {error}</p> : null}
      {downloads.length === 0 ? (
        <p className="hint">Nenhum download. Busque um modelo acima e escolha um arquivo.</p>
      ) : (
        <ul className="model-list" aria-label="Lista de downloads">
          {downloads.map((item) => {
            const nameId = `${ids}-${item.id}`;
            const activeNow = ACTIVE_DOWNLOAD_STATES.has(item.state);
            const canRetry = item.state === "error" || item.state === "cancelled" || item.state === "interrupted";
            const percent = Math.round(item.progress * 100);
            return (
              <li key={item.id} className="model download-item">
                <p className="model__name" id={nameId}>
                  {item.name}
                </p>
                <p className="model__meta">
                  {item.repo}
                  {item.parts > 1 ? ` · ${item.parts} partes` : ""}
                </p>
                <p className={`download-state download-state--${item.state}`}>
                  {DOWNLOAD_STATE_LABEL[item.state]}
                  {item.state === "downloading" && item.total_bytes > 0 ? ` · ${percent}%` : ""}
                  {activeNow && item.speed_bps > 0 ? ` · ${speedLabel(item.speed_bps)}` : ""}
                </p>
                {item.total_bytes > 0 && item.state !== "done" ? (
                  <progress
                    className="progress"
                    aria-labelledby={nameId}
                    aria-valuetext={`${percent}%`}
                    max={1}
                    value={item.progress}
                  />
                ) : null}
                {bytesLabel(item) ? <p className="model__meta">{bytesLabel(item)}</p> : null}
                {item.state === "done" ? (
                  <p className={item.verified ? "fit fit--gpu" : "warning"}>
                    {item.verified
                      ? "Integridade conferida pelo SHA-256 publicado. O modelo já aparece em Modelos locais."
                      : (item.warning ?? "Concluído sem verificação de integridade.")}
                  </p>
                ) : null}
                {item.error ? (
                  <p className="panel__error">{item.error.message}</p>
                ) : item.state === "interrupted" ? (
                  <p className="panel__error">
                    Download interrompido (o app foi fechado). Use Tentar de novo para continuar de onde parou.
                  </p>
                ) : null}
                <div className="actions">
                  {activeNow ? (
                    <button
                      type="button"
                      className="button button--secondary"
                      aria-describedby={nameId}
                      disabled={busy === item.id}
                      onClick={() => void run(item.id, onCancel)}
                    >
                      Cancelar
                    </button>
                  ) : null}
                  {canRetry ? (
                    <button
                      type="button"
                      className="button button--primary"
                      aria-describedby={nameId}
                      disabled={busy === item.id}
                      onClick={() => void run(item.id, onRetry)}
                    >
                      Tentar de novo
                    </button>
                  ) : null}
                  {!activeNow ? (
                    <button
                      type="button"
                      className="button button--secondary"
                      aria-describedby={nameId}
                      disabled={busy === item.id}
                      onClick={() => void run(item.id, onForget)}
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {downloads.some((d) => d.state !== "done" && !ACTIVE_DOWNLOAD_STATES.has(d.state)) ? (
        <p className="hint">
          Limpar um download não concluído apaga o que já foi baixado; Tentar de novo continua de onde parou.
        </p>
      ) : null}
      {actionError ? (
        <p className="panel__error" role="alert">
          Erro: {actionError}
        </p>
      ) : null}
    </section>
  );
}
