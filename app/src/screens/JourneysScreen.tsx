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
import { usePortraitUrl } from "../hooks/usePortraitUrl";
import { describeError, formatBackupDate, formatSavedAgo, formatSavedAt, STATUS_LABEL, STATUS_NOTICE } from "../lib/format";
import { Badge, Button, Dialog, PixelIcon, Portrait, RadioGroup, type BadgeTone } from "../ui";
import "./JourneysScreen.css";

export interface JourneysScreenProps {
  info: BackendInfo;
  list: JourneyList | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<JourneyList | null>;
  onOpen: (journey: JourneySummary) => void;
  onNew: () => void;
  opening: string | null;
  openError: string | null;
  /** Aviso vindo de outra tela (por exemplo, Jornada criada que não abriu). */
  notice?: string | null;
}

const TONE: Record<string, BadgeTone> = { ok: "success", danificada: "danger", mais_nova: "warn", sem_mundo: "warn" };
const FILTERS = [["all", "Todas"], ["scene", "Em Cena"], ["outside", "Fora de Cena"], ["problem", "Com problema"]] as const;
type Filter = (typeof FILTERS)[number][0];

const label = (j: JourneySummary) => j.name ?? "Jornada sem nome";
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const category = (j: JourneySummary) => j.status !== "ok" ? "problem" : j.current_scene_title ? "scene" : "outside";
const savedAt = (j: JourneySummary) => j.last_saved_at ?? j.created_at;
const savedTime = (j: JourneySummary) => {
  const time = Date.parse(savedAt(j) ?? "");
  return Number.isNaN(time) ? -Infinity : time;
};

function JourneyPortrait({ info, journey }: { info: BackendInfo; journey: JourneySummary }) {
  const src = usePortraitUrl(info, journey.portrait?.url_path ?? null);
  return <Portrait name={journey.character_name ?? label(journey)} src={src} crop={journey.portrait?.crop ?? null} size="sm" />;
}

type RestoreState =
  | { journey: JourneySummary; kind: "loading" }
  | { journey: JourneySummary; kind: "ready"; backups: BackupInfo[]; chosen: string | null; sending: boolean; error: string | null }
  | { journey: JourneySummary; kind: "error"; error: string };

export function JourneysScreen({ info, list, loading, error, reload, onOpen, onNew, opening, openError, notice }: JourneysScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ journey: JourneySummary; sending: boolean; error: string | null } | null>(null);
  const [restoring, setRestoring] = useState<RestoreState | null>(null);
  const [announce, setAnnounce] = useState("");
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const confirmDelete = async () => {
    if (!removing) return;
    setRemoving({ ...removing, sending: true, error: null });
    try {
      await deleteJourney(info, removing.journey.id);
      setRemoving(null);
      setAnnounce(`Jornada “${label(removing.journey)}” excluída. O Mundo dela continua salvo.`);
      await reload();
      titleRef.current?.focus();
    } catch (err) {
      setRemoving({ ...removing, sending: false, error: describeError(err) });
    }
  };

  const startRestore = async (journey: JourneySummary) => {
    const pending: RestoreState = { journey, kind: "loading" };
    setRestoring(pending);
    try {
      const { backups } = await listBackups(info, journey.id);
      setRestoring((current) => current === pending
        ? { journey, kind: "ready", backups, chosen: backups[0]?.name ?? null, sending: false, error: null } : current);
    } catch (err) {
      setRestoring((current) => current === pending ? { journey, kind: "error", error: describeError(err) } : current);
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
  const isEmpty = list !== null && !error && journeys.length === 0;
  const latest = journeys.reduce<JourneySummary | null>((best, j) => !best || savedTime(j) > savedTime(best) ? j : best, null);
  const counts = { all: journeys.length, scene: 0, outside: 0, problem: 0 };
  for (const journey of journeys) counts[category(journey)]++;
  const search = normalize(query.trim());
  const visible = journeys.filter((j) => (filter === "all" || category(j) === filter) &&
    [label(j), j.character_name, j.world_name, j.location].some((value) => normalize(value ?? "").includes(search)));
  const selected = visible.find((j) => j.id === selectedId) ?? visible.find((j) => j.id === latest?.id) ?? visible[0];
  const newJourney = <Button variant="primary" onClick={onNew}><PixelIcon name="plus" /> Nova Jornada</Button>;

  return (
    <section className="journeys" aria-labelledby="journeys-title">
      <header className="journeys__header">
        <div>
          <h2 id="journeys-title" ref={titleRef} tabIndex={-1} className="screen-title">Jornadas</h2>
          <p className="hint">Escolha uma Jornada para continuar sua história.</p>
        </div>
        {!isEmpty ? newJourney : null}
      </header>
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
      ) : list === null ? (
        <p className="hint" role="status">{loading ? "Carregando as Jornadas…" : "Preparando a biblioteca…"}</p>
      ) : journeys.length === 0 ? (
        <div className="journeys__empty px-frame surface-parchment">
          <PixelIcon name="scroll" size={32} />
          <h3>Nenhuma Jornada ainda</h3>
          <p>Crie a sua primeira Jornada: um Mundo, um personagem e uma história com o Aduran.</p>
          {newJourney}
        </div>
      ) : (
        <div className="journeys__layout">
          <aside className="journeys__library px-frame surface-dark" aria-label="Biblioteca de Jornadas">
            <h3 className="journeys__library-title">Jornadas <Badge>{journeys.length}</Badge></h3>
            <label className="field">
              <span className="field__label">Buscar Jornadas</span>
              <input className="field__control px-frame" type="search" placeholder="Nome, personagem, Mundo ou lugar"
                value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="journeys__filters" role="group" aria-label="Filtrar Jornadas">
              {FILTERS.map(([key, text]) => (
                <button key={key} type="button" className="journeys__filter"
                  aria-pressed={filter === key} onClick={() => setFilter(key)}>{text} <strong>{counts[key]}</strong></button>
              ))}
            </div>
            {visible.length ? (
              <ul className="journeys__list" aria-label="Jornadas salvas">
                {visible.map((j) => (
                  <li key={j.id}>
                    <button type="button" className="journeys__entry" aria-pressed={selected?.id === j.id}
                      aria-labelledby={`journey-${j.id}`} aria-controls="journeys-detail" onClick={() => setSelectedId(j.id)}>
                      <JourneyPortrait info={info} journey={j} />
                      <span className="journeys__identity">
                        <strong id={`journey-${j.id}`}>{label(j)}</strong>
                        <span>{j.character_name ?? "Sem personagem"} · {j.location ?? "Lugar desconhecido"}</span>
                        <span>Mundo: {j.world_name ?? "desconhecido"}</span>
                        <span className="journeys__tags">
                          {latest?.id === j.id ? <Badge tone="accent">Última</Badge> : null}
                          <Badge tone={j.status !== "ok" ? TONE[j.status] ?? "neutral" : category(j) === "scene" ? "success" : "neutral"}>
                            {j.status !== "ok" ? STATUS_LABEL[j.status] ?? j.status : category(j) === "scene" ? "Em Cena" : "Fora de Cena"}
                          </Badge>
                          <span title={formatSavedAt(savedAt(j))}>{formatSavedAgo(savedAt(j))}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="hint" role="status">Nenhuma Jornada combina com a busca ou o filtro.</p>}
          </aside>
          <section id="journeys-detail" className="journeys__detail px-frame surface-parchment"
            aria-label="Detalhe da Jornada">
            {selected ? (
              <>
                <div className="journeys__actions">
                  {selected.status === "danificada" ? (
                    <Button variant="primary" disabled={opening !== null} onClick={() => void startRestore(selected)}>Restaurar…</Button>
                  ) : (
                    <Button variant="primary" disabled={selected.status !== "ok" || opening !== null}
                      loading={opening === selected.id} onClick={() => onOpen(selected)}>Continuar Jornada</Button>
                  )}
                  <Button variant="danger" size="sm" disabled={opening !== null}
                    onClick={() => setRemoving({ journey: selected, sending: false, error: null })}>Excluir</Button>
                </div>
                <div className="journeys__detail-head">
                  <JourneyPortrait key={selected.id} info={info} journey={selected} />
                  <div className="journeys__identity">
                    <h3>{label(selected)}</h3>
                    <div className="journeys__tags">
                      <Badge>{selected.character_name ?? "Sem personagem"}</Badge>
                      <Badge>{selected.world_name ?? "Mundo desconhecido"}</Badge>
                      <Badge tone={TONE[selected.status] ?? "neutral"}>{STATUS_LABEL[selected.status] ?? selected.status}</Badge>
                      {latest?.id === selected.id ? <Badge tone="accent">Última jogada</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="journeys__detail-body">
                  {selected.status === "ok" ? (
                    <><h4>Pontos de retorno</h4><p>Os pontos de retorno ainda não estão disponíveis.</p></>
                  ) : (
                    <p className={`callout callout--${selected.status === "danificada" ? "danger" : "warn"}`} role="alert">
                      {selected.error_message ?? STATUS_NOTICE[selected.status] ?? "Não foi possível abrir esta Jornada."}
                      {selected.status === "mais_nova" && selected.error_message ? " Atualize o aplicativo para continuar." : null}
                    </p>
                  )}
                </div>
              </>
            ) : <p className="journeys__detail-body">Escolha uma Jornada na lista para ver os detalhes.</p>}
          </section>
        </div>
      )}

      <Dialog
        open={removing !== null}
        tone="danger"
        title={`Excluir “${removing ? label(removing.journey) : ""}”?`}
        description={
          <p>
            Isto apaga a Jornada do disco, com o personagem e os backups dela, e não pode ser desfeito. O Mundo da Jornada
            continua salvo na tela Mundos.
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
