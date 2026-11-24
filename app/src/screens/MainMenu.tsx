import { useEffect, useState } from "react";

import type { BackendInfo } from "../api/backend";
import type { EngineStatus } from "../api/engine";
import { fetchPortraitAt, type JourneyList, type JourneySummary } from "../api/journeys";
import type { BackendStatus } from "../hooks/useBackend";
import { formatSavedAgo, formatSavedAt, STATUS_NOTICE, toPeriod } from "../lib/format";
import { Button, Panel, PERIOD_LABEL, PeriodIcon, PixelIcon, Portrait } from "../ui";
import { calendarText } from "./journey/journeyText";
import { MenuLandscape } from "./menu/MenuLandscape";
import { Banner, BookIcon, CompassMark, Diamond, FrameCorner } from "./menu/menuArt";
import { ServiceIndicator } from "./ServiceIndicator";

import "./menu/MainMenu.css";

export { serviceState } from "./ServiceIndicator";

/** A última Jornada jogada (`last_journey_id`); sem ela, a salva mais recentemente. */
export function pickLastJourney(list: JourneyList | null): JourneySummary | null {
  if (!list || list.journeys.length === 0) return null;
  return list.journeys.find((j) => j.id === list.last_journey_id) ?? list.journeys[0] ?? null;
}

export interface MainMenuProps {
  /** Estado do serviço local (rodapé e botões). */
  backend: BackendStatus;
  /** Estado do motor de IA (rodapé); `null` enquanto não se sabe. */
  engine: EngineStatus | null;
  /** Versão do app, no rodapé. */
  version: string;
  list: JourneyList | null;
  listError: string | null;
  opening: boolean;
  openError: string | null;
  onContinue: (journey: JourneySummary) => void;
  onNew: () => void;
  onJourneys: () => void;
  /** Tela de Mundos (modelo inicial provisório; docs/ui-ux/13-mundos.md). */
  onWorlds?: () => void;
  onModels: () => void;
  canExit: boolean;
  onExit: () => void;
}

/**
 * Menu inicial (docs/ui-ux/11-menu-inicial.md): paisagem viva do período da última
 * Jornada, título e botões no eixo central, cartão da última Jornada à direita da
 * coluna (embaixo dela em telas estreitas) e rodapé com a versão e o indicador do
 * serviço e do modelo, que abre Modelos.
 */
export function MainMenu({
  backend,
  engine,
  version,
  list,
  listError,
  opening,
  openError,
  onContinue,
  onNew,
  onJourneys,
  onWorlds,
  onModels,
  canExit,
  onExit,
}: MainMenuProps) {
  const info = backend.kind === "connected" ? backend.info : null;
  const connected = info !== null;
  const last = pickLastJourney(list);
  const usable = last !== null && last.status === "ok";
  const period = toPeriod(last?.day_period ?? null);

  return (
    <div className="menu">
      <MenuLandscape period={period} className="menu__scene" />
      <FrameCorner className="menu-corner--tl" />
      <FrameCorner className="menu-corner--tr" />
      <FrameCorner className="menu-corner--bl" />
      <FrameCorner className="menu-corner--br" />
      <Banner side="left" />
      <Banner side="right" />

      <div className="menu__stage">
        <header className="menu__title-block">
          <div className="menu__logo">
            <CompassMark width={56} className="menu__mark" />
            <h1 className="menu__title">Henduran</h1>
            <CompassMark width={56} className="menu__mark menu__mark--mirror" />
          </div>
          <div className="menu__rule" aria-hidden="true">
            <i />
            <Diamond />
            <i />
          </div>
          <p className="menu__subtitle">Jornada solo de fantasia com Narrador IA</p>
        </header>

        <div className="menu__main">
          <nav className="menu__buttons" aria-label="Menu inicial">
            <Button
              variant="primary"
              className="menu__button menu__button--main"
              disabled={!connected || !usable}
              loading={opening}
              onClick={() => last && onContinue(last)}
            >
              <PixelIcon name="star" size={24} />
              <span className="menu__button-text">Continuar Jornada</span>
            </Button>
            <Button className="menu__button" disabled={!connected} onClick={onNew}>
              <PixelIcon name="sword" size={24} />
              <span className="menu__button-text">Nova Jornada</span>
            </Button>
            <Button className="menu__button" disabled={!connected} onClick={onJourneys}>
              <BookIcon width={24} />
              <span className="menu__button-text">Jornadas</span>
            </Button>
            {onWorlds ? (
              <Button className="menu__button" disabled={!connected} onClick={onWorlds}>
                <PixelIcon name="globe" size={24} />
                <span className="menu__button-text">Mundos</span>
              </Button>
            ) : null}
            {canExit ? (
              <Button className="menu__button" onClick={onExit}>
                <PixelIcon name="door" size={24} />
                <span className="menu__button-text">Sair</span>
              </Button>
            ) : null}
          </nav>

          {openError ? (
            <div className="callout callout--danger menu__error" role="alert">
              <p>{openError}</p>
              <div className="actions">
                <Button size="sm" onClick={onJourneys}>
                  Ver Jornadas
                </Button>
              </div>
            </div>
          ) : null}

          <LastJourneyCard
            backend={backend}
            info={info}
            list={list}
            listError={listError}
            journey={last}
            onJourneys={onJourneys}
          />
        </div>
      </div>

      <footer className="menu__foot">
        <p className="menu__version">
          <PixelIcon name="star" className="menu__version-mark" />
          <span>Henduran · v{version}</span>
        </p>
        <span className="menu__foot-mid" aria-hidden="true">
          <Diamond width={18} />
        </span>
        <ServiceIndicator className="menu__service" backend={backend} engine={engine} onModels={onModels} />
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------ cartão */

interface CardProps {
  backend: BackendStatus;
  info: BackendInfo | null;
  list: JourneyList | null;
  listError: string | null;
  journey: JourneySummary | null;
  onJourneys: () => void;
}

const CARD_TITLE = (
  <>
    <PixelIcon name="scroll" className="last-journey__title-icon" /> Última Jornada
  </>
);

/** Cartão preso à direita da coluna de botões (abaixo dela em telas estreitas). */
function LastJourneyCard({ backend, info, list, listError, journey, onJourneys }: CardProps) {
  if (backend.kind !== "connected") {
    return (
      <Panel title={CARD_TITLE} titleLevel={2} variant="parchment" className="last-journey last-journey--message">
        <p>{backend.kind === "starting" ? "Preparando o serviço local…" : "O serviço local não respondeu. Veja o aviso no rodapé."}</p>
      </Panel>
    );
  }
  if (listError) {
    return (
      <Panel title={CARD_TITLE} titleLevel={2} variant="parchment" className="last-journey last-journey--message">
        <p className="text-danger">{listError}</p>
      </Panel>
    );
  }
  if (list === null) {
    return (
      <Panel title={CARD_TITLE} titleLevel={2} variant="parchment" className="last-journey last-journey--message">
        <p>Carregando…</p>
      </Panel>
    );
  }
  if (!journey) return null;
  return <JourneyCard info={info} journey={journey} onJourneys={onJourneys} />;
}

/** O retrato da Jornada vem como blob (a rota exige o token) e vira uma URL local, revogada ao trocar. */
function usePortraitUrl(info: BackendInfo | null, urlPath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!info || !urlPath || typeof URL.createObjectURL !== "function") return;
    const controller = new AbortController();
    let created: string | null = null;
    fetchPortraitAt(info, urlPath, controller.signal)
      .then((blob) => {
        if (!blob || controller.signal.aborted) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => undefined); // sem retrato, as iniciais
    return () => {
      controller.abort();
      if (created && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(created);
    };
  }, [info, urlPath]);
  return url;
}

function JourneyCard({ info, journey, onJourneys }: { info: BackendInfo | null; journey: JourneySummary; onJourneys: () => void }) {
  const portraitUrl = usePortraitUrl(info, journey.portrait?.url_path ?? null);
  const notice = journey.status === "ok" ? null : (STATUS_NOTICE[journey.status] ?? journey.error_message);
  const period = journey.day_period ? toPeriod(journey.day_period) : null;
  const date = calendarText(journey.calendar);
  const saved = journey.last_saved_at ?? journey.created_at;
  const who = journey.character_name ?? journey.name ?? "?";

  return (
    <Panel title={CARD_TITLE} titleLevel={2} variant="parchment" className="last-journey">
      <div className="last-journey__body">
        <Portrait name={who} src={portraitUrl} crop={journey.portrait?.crop ?? null} size="sm" className="last-journey__portrait" />
        <div className="last-journey__info">
          <p className="last-journey__name">{journey.name ?? "Jornada sem nome"}</p>
          <ul className="last-journey__facts">
            <li>
              <PixelIcon name="person" />
              <span>
                <span className="visually-hidden">Personagem: </span>
                {journey.character_name ?? "sem personagem"}
              </span>
            </li>
            <li>
              <PixelIcon name="pin" />
              <span>
                <span className="visually-hidden">Lugar: </span>
                {journey.location ?? "lugar desconhecido"}
                {journey.world_name ? `, ${journey.world_name}` : ""}
              </span>
            </li>
            {period ? (
              <li>
                <PeriodIcon period={period} size={14} />
                <span>
                  <span className="visually-hidden">Período do dia: </span>
                  <b>{PERIOD_LABEL[period]}</b>
                  {date ? <span className="last-journey__date"> · {date}</span> : null}
                </span>
              </li>
            ) : null}
            {journey.current_scene_title ? (
              <li className="last-journey__scene">
                <PixelIcon name="seal" />
                <span>Em Cena: “{journey.current_scene_title}”</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      {notice ? (
        <p className="last-journey__warn" role="note">
          <PixelIcon name="warning" />
          <span>
            {notice}
            {notice.includes("Jornadas") ? null : (
              <>
                {" "}
                Abra <b>Jornadas</b> para ver as opções.
              </>
            )}
          </span>
        </p>
      ) : null}
      <div className="last-journey__foot">
        <span className="last-journey__saved">
          <PixelIcon name="clock" />
          {saved ? (
            <time dateTime={saved} title={formatSavedAt(saved)}>
              {formatSavedAgo(saved)}
            </time>
          ) : (
            <span>{formatSavedAgo(null)}</span>
          )}
        </span>
        <Button variant="ghost" size="sm" className="last-journey__all" onClick={onJourneys}>
          Ver todas
        </Button>
      </div>
    </Panel>
  );
}
