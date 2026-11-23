import { useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { formatBytes } from "../api/engine";
import {
  deleteJourney,
  listBackups,
  restoreBackup,
  type BackupInfo,
  type JourneyList,
  type JourneySummary,
} from "../api/journeys";
import { describeError, formatBackupDate, formatSavedAt, STATUS_LABEL } from "../lib/format";
import { Badge, Button, Dialog, ListCard, PixelIcon, RadioGroup, type BadgeTone } from "../ui";

export interface JourneysScreenProps {
  info: BackendInfo;
  list: JourneyList | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<JourneyList | null>;
  onOpen: (journey: JourneySummary) => void;
  opening: string | null;
  openError: string | null;
  /** Aviso vindo de outra tela (por exemplo, Jornada criada que não abriu). */
  notice?: string | null;
}

const TONE: Record<string, BadgeTone> = { ok: "success", danificada: "danger", mais_nova: "warn", sem_mundo: "warn" };

type RestoreState =
  | { journey: JourneySummary; kind: "loading" }
  | { journey: JourneySummary; kind: "ready"; backups: BackupInfo[]; chosen: string | null; sending: boolean; error: string | null }
  | { journey: JourneySummary; kind: "error"; error: string };

/** Lista de Jornadas com Abrir, Excluir e (para as danificadas) Restaurar. */
export function JourneysScreen({ info, list, loading, error, reload, onOpen, opening, openError, notice }: JourneysScreenProps) {
  const [removing, setRemoving] = useState<{ journey: JourneySummary; sending: boolean; error: string | null } | null>(null);
  const [restoring, setRestoring] = useState<RestoreState | null>(null);
  const [announce, setAnnounce] = useState("");
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const label = (j: JourneySummary) => j.name ?? "Jornada sem nome";

  const confirmDelete = async () => {
    if (!removing) return;
    setRemoving({ ...removing, sending: true, error: null });
    try {
      const result = await deleteJourney(info, removing.journey.id);
      setRemoving(null);
      setAnnounce(
        `Jornada “${label(removing.journey)}” excluída.${result.world_deleted ? " O Mundo dela também foi apagado." : ""}`,
      );
      await reload();
      titleRef.current?.focus();
    } catch (err) {
      setRemoving({ ...removing, sending: false, error: describeError(err) });
    }
  };

  const startRestore = async (journey: JourneySummary) => {
    setRestoring({ journey, kind: "loading" });
    try {
      const { backups } = await listBackups(info, journey.id);
      setRestoring({ journey, kind: "ready", backups, chosen: backups[0]?.name ?? null, sending: false, error: null });
    } catch (err) {
      setRestoring({ journey, kind: "error", error: describeError(err) });
    }
  };

  const confirmRestore = async () => {
    if (!restoring || restoring.kind !== "ready" || !restoring.chosen) return;
    setRestoring({ ...restoring, sending: true, error: null });
    try {
      const result = await restoreBackup(info, restoring.journey.id, restoring.chosen);
      setRestoring(null);
      setAnnounce(
        `Jornada restaurada a partir de ${result.restored_from}.${
          result.preserved_as ? ` O arquivo danificado foi guardado como ${result.preserved_as}.` : ""
        }`,
      );
      await reload();
      titleRef.current?.focus();
    } catch (err) {
      setRestoring({ ...restoring, sending: false, error: describeError(err) });
    }
  };

  const journeys = list?.journeys ?? [];

  return (
    <section className="journeys" aria-labelledby="journeys-title">
      <h2 id="journeys-title" ref={titleRef} tabIndex={-1} className="screen-title">
        Jornadas
      </h2>
      {notice ? <p className="callout callout--warn">{notice}</p> : null}
      {openError ? (
        <p className="callout callout--danger" role="alert">
          {openError}
        </p>
      ) : null}
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      {/* Visível para quem enxerga; o leitor de tela já recebe pela região acima. */}
      {announce ? (
        <p className="callout callout--ok" aria-hidden="true">
          {announce}
        </p>
      ) : null}

      {error ? (
        <div className="callout callout--danger" role="alert">
          <p>{error}</p>
          <div className="actions">
            <Button size="sm" onClick={() => void reload()}>
              Tentar de novo
            </Button>
          </div>
        </div>
      ) : list === null && loading ? (
        <p className="hint">Carregando as Jornadas…</p>
      ) : journeys.length === 0 ? (
        <div className="empty px-frame surface-parchment">
          <p>Nenhuma Jornada salva. Crie uma pelo menu inicial, em Nova Jornada.</p>
        </div>
      ) : (
        <ul className="card-list">
          {journeys.map((j) => {
            const titleId = `journey-${j.id}`;
            return (
              <ListCard
                key={j.id}
                title={label(j)}
                titleId={titleId}
                selected={j.id === list?.last_journey_id}
                tags={
                  <>
                    {j.id === list?.last_journey_id ? (
                      <Badge tone="accent" icon={<PixelIcon name="star" />}>
                        Última jogada
                      </Badge>
                    ) : null}
                    <Badge tone={TONE[j.status] ?? "neutral"}>{STATUS_LABEL[j.status] ?? j.status}</Badge>
                  </>
                }
                meta={`${j.character_name ?? "sem personagem"} · ${j.location ?? "local desconhecido"} · Mundo: ${
                  j.world_name ?? "desconhecido"
                }`}
                actions={
                  <>
                    <Button
                      variant="primary"
                      aria-describedby={titleId}
                      disabled={j.status !== "ok" || opening !== null}
                      loading={opening === j.id}
                      onClick={() => onOpen(j)}
                    >
                      Abrir
                    </Button>
                    {j.status === "danificada" ? (
                      <Button aria-describedby={titleId} onClick={() => void startRestore(j)}>
                        Restaurar
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      aria-describedby={titleId}
                      onClick={() => setRemoving({ journey: j, sending: false, error: null })}
                    >
                      Excluir
                    </Button>
                  </>
                }
              >
                <p className="list-card__meta">
                  Salvo em: {formatSavedAt(j.last_saved_at ?? j.created_at)} · Regras: {j.rules_version ?? "desconhecida"}
                </p>
                {j.status !== "ok" && j.error_message ? <p className="list-card__meta text-warn">{j.error_message}</p> : null}
              </ListCard>
            );
          })}
        </ul>
      )}

      <Dialog
        open={removing !== null}
        tone="danger"
        title={`Excluir “${removing ? label(removing.journey) : ""}”?`}
        description={
          <p>
            Isto apaga a Jornada do disco, com o personagem e os backups dela, e não pode ser desfeito. O Mundo da Jornada
            também é apagado se nenhuma outra Jornada o usar.
          </p>
        }
        onClose={() => setRemoving(null)}
        dismissible={!removing?.sending}
        initialFocusRef={keepRef}
        actions={
          <>
            <Button ref={keepRef} onClick={() => setRemoving(null)} disabled={removing?.sending}>
              Cancelar
            </Button>
            <Button variant="danger" loading={removing?.sending ?? false} onClick={() => void confirmDelete()}>
              Excluir do disco
            </Button>
          </>
        }
      >
        {removing?.error ? (
          <p className="callout callout--danger" role="alert">
            {removing.error}
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={restoring !== null}
        title={`Restaurar “${restoring ? label(restoring.journey) : ""}”`}
        description={
          <p>
            Escolha um backup. O arquivo atual, danificado, não é apagado: fica guardado ao lado com outro nome.
          </p>
        }
        onClose={() => setRestoring(null)}
        dismissible={!(restoring?.kind === "ready" && restoring.sending)}
        actions={
          <>
            <Button onClick={() => setRestoring(null)} disabled={restoring?.kind === "ready" && restoring.sending}>
              Cancelar
            </Button>
            {restoring?.kind === "ready" && restoring.backups.length > 0 ? (
              <Button
                variant="primary"
                disabled={!restoring.chosen}
                loading={restoring.sending}
                onClick={() => void confirmRestore()}
              >
                Restaurar
              </Button>
            ) : null}
          </>
        }
      >
        {restoring?.kind === "loading" ? <p>Procurando backups…</p> : null}
        {restoring?.kind === "error" ? (
          <p className="callout callout--danger" role="alert">
            {restoring.error}
          </p>
        ) : null}
        {restoring?.kind === "ready" ? (
          restoring.backups.length === 0 ? (
            <p>Não há backups desta Jornada.</p>
          ) : (
            <>
              <RadioGroup
                legend="Backups (do mais novo ao mais antigo)"
                value={restoring.chosen}
                onChange={(chosen) => setRestoring({ ...restoring, chosen })}
                options={restoring.backups.map((b) => ({
                  value: b.name,
                  label: formatBackupDate(b.created),
                  description: `${b.name} · ${formatBytes(b.size_bytes)} · esquema ${b.schema_version}`,
                }))}
              />
              {restoring.error ? (
                <p className="callout callout--danger" role="alert">
                  {restoring.error}
                </p>
              ) : null}
            </>
          )
        ) : null}
      </Dialog>
    </section>
  );
}
