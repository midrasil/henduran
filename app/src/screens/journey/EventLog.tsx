import { useEffect, useState } from "react";

import type { BackendInfo } from "../../api/backend";
import { fetchEvents, type JourneyEvent } from "../../api/journeyScreen";
import { describeError } from "../../lib/format";
import { PixelIcon, type PixelIconName } from "../../ui";
import { eventLine, eventMoment } from "./journeyText";

const ICON: Record<string, PixelIconName> = {
  cena_aberta: "door",
  cena_encerrada: "seal",
  lugar: "pin",
  cena_renomeada: "pen",
};

export interface EventLogProps {
  info: BackendInfo;
  /** Só os eventos desta Cena; `null` = o Log da Jornada inteira. */
  sceneId: number | null;
  characterName: string;
  /** Muda a cada operação concluída: relê os eventos. */
  revision: number;
}

/** Log do motor, do mais recente ao mais antigo (ADR-076, item 14). */
export function EventLog({ info, sceneId, characterName, revision }: EventLogProps) {
  const [events, setEvents] = useState<JourneyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchEvents(info, sceneId)
      .then((r) => {
        if (!active) return;
        setEvents(r.events);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) setError(describeError(err, "Não foi possível ler o Log."));
      });
    return () => {
      active = false;
    };
  }, [info, sceneId, revision]);

  if (error) {
    return (
      <p className="callout callout--danger stage__pad" role="alert">
        {error}
      </p>
    );
  }
  if (!events) return <p className="hint stage__pad">Carregando o Log…</p>;
  if (events.length === 0) return <p className="hint stage__pad">Nada registrado ainda.</p>;

  return (
    <ul className="events" aria-label={sceneId === null ? "Eventos da Jornada" : "Eventos da Cena"}>
      {[...events].reverse().map((event) => {
        const line = eventLine(event, characterName);
        return (
          <li key={event.id} className="events__item">
            <span className="events__icon" aria-hidden="true">
              <PixelIcon name={ICON[event.kind] ?? "scroll"} />
            </span>
            <span>
              <b>{line.label}</b>
              {line.text ? ` · ${line.text}` : ""}
              {line.detail ? <span className="events__detail">{line.detail}</span> : null}
              <time className="events__time" dateTime={event.created_at}>
                {eventMoment(event)}
              </time>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
