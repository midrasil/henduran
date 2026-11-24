import { useEffect, useId, useRef, useState } from "react";

import { formatBytes } from "../../api/engine";
import { ACTIVE_DOWNLOAD_STATES, DOWNLOAD_STATE_LABEL, type DownloadItem } from "../../api/hub";
import { Badge, Button, ListCard, PixelIcon, ProgressBar, type BadgeTone } from "../../ui";
import { describe, plural } from "./modelsText";

export interface DownloadsPaneProps {
  downloads: DownloadItem[];
  error: string | null;
  onCancel: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onForget: (id: string) => Promise<void>;
  onShowMine: () => void;
}

const TONE: Record<DownloadItem["state"], BadgeTone> = {
  queued: "info",
  downloading: "info",
  verifying: "info",
  done: "success",
  error: "danger",
  cancelled: "neutral",
  interrupted: "warn",
};

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

/** Aba **Downloads**: progresso, velocidade, estado e SHA-256, com Cancelar, Retomar e Remover da lista. */
export function DownloadsPane({ downloads, error, onCancel, onRetry, onForget, onShowMine }: DownloadsPaneProps) {
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

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(describe(err));
    } finally {
      setBusy(null);
    }
  };

  const active = downloads.filter((d) => ACTIVE_DOWNLOAD_STATES.has(d.state)).length;
  const done = downloads.filter((d) => d.state === "done");

  return (
    <div className="mdl-pane-body">
      <p className="visually-hidden" aria-live="polite" data-testid="downloads-live">
        {live}
      </p>
      {error ? <p className="text-danger">Não foi possível consultar os downloads: {error}</p> : null}
      {downloads.length === 0 ? (
        <p className="hint">Nenhum download ainda. Os arquivos que você baixar aparecem aqui.</p>
      ) : (
        <>
          <div className="mdl-toolbar">
            <p>
              {active === 0 ? "Nenhum download ativo" : plural(active, "download ativo", "downloads ativos")}. Os arquivos
              ficam na pasta de modelos do Henduran.
            </p>
            <Button
              size="sm"
              disabled={done.length === 0 || busy !== null}
              onClick={() =>
                void run("__all__", async () => {
                  for (const item of done) await onForget(item.id);
                })
              }
            >
              Limpar concluídos
            </Button>
          </div>
          <ul className="card-list" aria-label="Lista de downloads">
            {downloads.map((item) => {
              const nameId = `${ids}-${item.id}`;
              const activeNow = ACTIVE_DOWNLOAD_STATES.has(item.state);
              const canRetry = item.state === "error" || item.state === "cancelled" || item.state === "interrupted";
              const percent = Math.round(item.progress * 100);
              const speed = activeNow && item.speed_bps > 0 ? `${formatBytes(item.speed_bps)}/s` : "";
              return (
                <ListCard
                  key={item.id}
                  title={item.name}
                  titleId={nameId}
                  tags={<Badge tone={TONE[item.state]}>{DOWNLOAD_STATE_LABEL[item.state]}</Badge>}
                  meta={
                    <>
                      {item.repo}
                      {item.parts > 1 ? ` · ${item.parts} partes` : ""}
                      {bytesLabel(item) ? ` · ${bytesLabel(item)}` : ""}
                      {item.state === "downloading" && item.total_bytes > 0 ? ` · ${percent}%` : ""}
                      {speed ? ` · ${speed}` : ""}
                    </>
                  }
                  actions={
                    <>
                      {activeNow ? (
                        <Button size="sm" aria-describedby={nameId} disabled={busy === item.id} onClick={() => void run(item.id, () => onCancel(item.id))}>
                          Cancelar
                        </Button>
                      ) : null}
                      {canRetry ? (
                        <Button
                          size="sm"
                          variant="primary"
                          aria-describedby={nameId}
                          disabled={busy === item.id}
                          onClick={() => void run(item.id, () => onRetry(item.id))}
                        >
                          Retomar
                        </Button>
                      ) : null}
                      {item.state === "done" ? (
                        <Button size="sm" aria-describedby={nameId} onClick={onShowMine}>
                          Ver em Meus modelos
                        </Button>
                      ) : null}
                      {!activeNow ? (
                        <Button size="sm" variant="ghost" aria-describedby={nameId} disabled={busy === item.id} onClick={() => void run(item.id, () => onForget(item.id))}>
                          Remover da lista
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  {item.total_bytes > 0 && item.state !== "done" ? (
                    <ProgressBar labelledBy={nameId} valueText={`${percent}%`} value={item.progress} />
                  ) : null}
                  {item.state === "done" ? (
                    <p className={item.verified ? "text-ok" : "callout callout--warn"}>
                      {item.verified ? (
                        <>
                          <PixelIcon name="check" /> SHA-256 conferido. O modelo já aparece em Meus modelos.
                        </>
                      ) : (
                        (item.warning ?? "Sem SHA-256 publicado: o arquivo não pôde ser conferido.")
                      )}
                    </p>
                  ) : null}
                  {item.error ? (
                    <p className="text-danger">{item.error.message}</p>
                  ) : item.state === "interrupted" ? (
                    <p className="text-danger">Download interrompido (o app foi fechado). Use Retomar para continuar de onde parou.</p>
                  ) : null}
                </ListCard>
              );
            })}
          </ul>
          {downloads.some((d) => d.state !== "done" && !ACTIVE_DOWNLOAD_STATES.has(d.state)) ? (
            <p className="hint">
              Remover da lista um download não concluído apaga o que já foi baixado; Retomar continua de onde parou.
            </p>
          ) : null}
        </>
      )}
      {actionError ? (
        <p className="callout callout--danger" role="alert">
          Erro: {actionError}
        </p>
      ) : null}
    </div>
  );
}
