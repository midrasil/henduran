import { useEffect, useState } from "react";

import type { BackendInfo } from "../../api/backend";
import { fetchPlaces, type PlacesView } from "../../api/journeyScreen";
import type { WorldContent } from "../../api/journeys";
import { describeError } from "../../lib/format";
import { Button, Dialog } from "../../ui";

export interface WorldDialogProps {
  open: boolean;
  onClose: () => void;
  info: BackendInfo;
  world: WorldContent | null;
  characterName: string;
}

/** Mundo e registro de lugares (ADR-076, item 13): lugares do Mundo e da Jornada, o atual e o caminho percorrido. */
export function WorldDialog({ open, onClose, info, world, characterName }: WorldDialogProps) {
  const [places, setPlaces] = useState<PlacesView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    fetchPlaces(info)
      .then((p) => {
        if (active) setPlaces(p);
      })
      .catch((err: unknown) => {
        if (active) setError(describeError(err, "Não foi possível ler os lugares."));
      });
    return () => {
      active = false;
    };
  }, [open, info]);

  return (
    <Dialog open={open} onClose={onClose} title={world ? `Mundo · ${world.name}` : "Mundo"} actions={<Button onClick={onClose}>Fechar</Button>}>
      {world ? (
        <p className="world-dlg__intro">
          {world.era.name} · {world.tone.name}. {world.era.description}
        </p>
      ) : null}
      <h3 className="sheet-sec__title">Lugares conhecidos</h3>
      {error ? (
        <p className="callout callout--danger" role="alert">
          {error}
        </p>
      ) : !places ? (
        <p className="hint">Carregando os lugares…</p>
      ) : (
        <>
          <ul className="places">
            {places.places.map((p) => (
              <li key={p.id} className={`places__item${p.current ? " places__item--here" : ""}`}>
                <span>
                  {p.name}
                  <small className="places__type">
                    {p.type}
                    {p.source === "jornada" ? " · descoberto nesta Jornada" : ""}
                  </small>
                </span>
                {p.current ? <span className="places__tag">Você está aqui</span> : null}
              </li>
            ))}
          </ul>
          <h3 className="sheet-sec__title">Por onde {characterName} passou</h3>
          <p className="places__path">{places.path.length ? places.path.map((p) => p.name ?? p.place_id).join(" → ") : "Ainda em nenhum lugar."}</p>
        </>
      )}
    </Dialog>
  );
}
