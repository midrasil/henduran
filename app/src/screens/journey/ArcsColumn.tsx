import type { Arc, ArcScene } from "../../api/journeyScreen";
import { toPeriod } from "../../lib/format";
import { PERIOD_LABEL, PeriodIcon, PixelIcon } from "../../ui";
import { ambitionStatusLabel, plural } from "./journeyText";

export interface ArcsColumnProps {
  arcs: Arc[];
  /** Id da Cena mostrada no centro (aberta ou encerrada em leitura). */
  currentId: number | null;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (scene: ArcScene) => void;
  /** Jornada sem abertura ainda. */
  pending: boolean;
  id?: string;
}

/** Card de uma Cena: só o ícone do período e o nome; a Cena aberta é o pergaminho com fita. */
export function SceneCard({ scene, current, onSelect }: { scene: ArcScene; current: boolean; onSelect: (scene: ArcScene) => void }) {
  const live = scene.status === "aberta";
  const period = toPeriod(scene.day_period);
  return (
    <button
      type="button"
      className={`scene-card${live ? " scene-card--live" : ""}`}
      aria-current={current ? "true" : undefined}
      title={[PERIOD_LABEL[period], scene.place_name].filter(Boolean).join(" · ")}
      onClick={() => onSelect(scene)}
    >
      <PeriodIcon period={period} size={20} />
      <span className="scene-card__title">{scene.title}</span>
      <span className="visually-hidden">{live ? " (em andamento)" : " (encerrada, só leitura)"}</span>
    </button>
  );
}

/**
 * Coluna dos Arcos (09-tela-da-jornada.md, item 2.2): arcos em ordem
 * cronológica e as Cenas de cada arco da primeira à última. Recolhida, vira
 * um trilho só com os ícones de período.
 */
export function ArcsColumn({ arcs, currentId, collapsed, onToggle, onSelect, pending, id }: ArcsColumnProps) {
  if (collapsed) {
    return (
      <nav className="col col--arcs col--rail" aria-label="Arcos e Cenas" id={id}>
        <div className="col__head col__head--center">
          <button type="button" className="mini-btn tip-start" aria-label="Expandir os Arcos" data-tip="Expandir" aria-expanded="false" onClick={onToggle}>
            <PixelIcon name="chevron-right" />
          </button>
        </div>
        <div className="col__scroll">
          <ol className="rail">
            {arcs.map((arc, ai) => (
              <li key={arc.objective_id ?? `arco-${ai}`} className="rail__arc">
                {ai > 0 ? <hr className="rail__sep" /> : null}
                <ol className="rail__list">
                  {arc.scenes.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`rail__btn tip-start${s.status === "aberta" ? " rail__btn--live" : ""}`}
                        aria-current={currentId === s.id ? "true" : undefined}
                        aria-label={`${s.title}${s.status === "aberta" ? " (em andamento)" : " (encerrada)"}`}
                        data-tip={s.title}
                        onClick={() => onSelect(s)}
                      >
                        <PeriodIcon period={toPeriod(s.day_period)} size={20} />
                      </button>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      </nav>
    );
  }

  return (
    <nav className="col col--arcs" aria-label="Arcos e Cenas" id={id}>
      <div className="col__head">
        <h2 className="col__title">Arcos</h2>
        <button type="button" className="mini-btn tip-end" aria-label="Recolher os Arcos" data-tip="Recolher" aria-expanded="true" onClick={onToggle}>
          <PixelIcon name="chevron-left" />
        </button>
      </div>
      <div className="col__scroll">
        {pending ? (
          <p className="col__note">A Cena inicial aparece aqui, no primeiro arco.</p>
        ) : (
          arcs.map((arc, ai) => {
            const statusLabel = ambitionStatusLabel(arc.status);
            const active = statusLabel === null;
            return (
              <details key={arc.objective_id ?? `arco-${ai}`} className={`arc${active ? "" : " arc--old"}`} open={active}>
                <summary className="arc__summary">
                  <span className="arc__label">
                    Arco {ai + 1}
                    {statusLabel ? ` · ${statusLabel}` : ""}
                  </span>
                  <span className="arc__ambition">{arc.text ?? "Sem Ambição registrada"}</span>
                  <span className="arc__count">{plural(arc.scenes.length, "Cena", "Cenas")}</span>
                </summary>
                <ol className="arc__scenes">
                  {arc.scenes.length ? (
                    arc.scenes.map((s) => (
                      <li key={s.id}>
                        <SceneCard scene={s} current={currentId === s.id} onSelect={onSelect} />
                      </li>
                    ))
                  ) : (
                    <li className="arc__empty">As próximas Cenas entram aqui.</li>
                  )}
                </ol>
              </details>
            );
          })
        )}
      </div>
    </nav>
  );
}
