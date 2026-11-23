import type { JourneyList, JourneySummary } from "../api/journeys";
import { formatSavedAt, STATUS_NOTICE, toPeriod } from "../lib/format";
import { Badge, Button, Panel, PeriodLabel, PixelIcon } from "../ui";

/** A última Jornada jogada (`last_journey_id`); sem ela, a salva mais recentemente. */
export function pickLastJourney(list: JourneyList | null): JourneySummary | null {
  if (!list || list.journeys.length === 0) return null;
  return list.journeys.find((j) => j.id === list.last_journey_id) ?? list.journeys[0] ?? null;
}

export interface MainMenuProps {
  connected: boolean;
  list: JourneyList | null;
  listError: string | null;
  opening: boolean;
  openError: string | null;
  onContinue: (journey: JourneySummary) => void;
  onNew: () => void;
  onJourneys: () => void;
  onModels: () => void;
  canExit: boolean;
  onExit: () => void;
}

/** Menu inicial: título, botões principais e o cartão da última Jornada. */
export function MainMenu({
  connected,
  list,
  listError,
  opening,
  openError,
  onContinue,
  onNew,
  onJourneys,
  onModels,
  canExit,
  onExit,
}: MainMenuProps) {
  const last = pickLastJourney(list);
  const usable = last !== null && last.status === "ok";

  return (
    <div className="menu">
      <header className="menu__title-plate px-frame">
        <h1 className="menu__title">
          <PixelIcon name="star" size={32} className="menu__mark" />
          Henduran
        </h1>
        <p className="menu__subtitle">Jornada solo de fantasia com Narrador IA</p>
      </header>

      <div className="menu__body">
        <nav className="menu__buttons" aria-label="Menu inicial">
          <Button
            variant="primary"
            className="menu__button menu__button--main"
            disabled={!connected || !usable}
            loading={opening}
            onClick={() => last && onContinue(last)}
          >
            <PixelIcon name="star" size={24} /> Continuar Jornada
          </Button>
          <Button className="menu__button" disabled={!connected} onClick={onNew}>
            <PixelIcon name="sword" size={24} /> Nova Jornada
          </Button>
          <Button className="menu__button" disabled={!connected} onClick={onJourneys}>
            <PixelIcon name="list" size={24} /> Jornadas
          </Button>
          <Button className="menu__button" disabled={!connected} onClick={onModels}>
            <PixelIcon name="gem" size={24} /> Modelos
          </Button>
          {canExit ? (
            <Button className="menu__button" onClick={onExit}>
              <PixelIcon name="door" size={24} /> Sair
            </Button>
          ) : null}
        </nav>

        <div className="menu__side">
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
          {!connected ? (
            <Panel title="Última Jornada" titleLevel={2} variant="parchment">
              <p>Esperando o serviço local ficar pronto…</p>
            </Panel>
          ) : listError ? (
            <Panel title="Última Jornada" titleLevel={2} variant="parchment">
              <p className="text-danger">{listError}</p>
            </Panel>
          ) : list === null ? (
            <Panel title="Última Jornada" titleLevel={2} variant="parchment">
              <p>Carregando…</p>
            </Panel>
          ) : last ? (
            <LastJourneyCard journey={last} onJourneys={onJourneys} />
          ) : (
            <Panel title="Comece a sua primeira Jornada" titleLevel={2} variant="parchment">
              <p>Você ainda não tem nenhuma Jornada. Gere um Mundo, crie um protagonista e comece a jogar.</p>
              <div className="actions">
                <Button variant="primary" onClick={onNew}>
                  Criar a primeira Jornada
                </Button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function LastJourneyCard({ journey, onJourneys }: { journey: JourneySummary; onJourneys: () => void }) {
  const notice = journey.status === "ok" ? null : (STATUS_NOTICE[journey.status] ?? journey.error_message);
  return (
    <Panel title="Última Jornada" titleLevel={2} variant="parchment" className="last-journey">
      <p className="last-journey__name">{journey.name ?? "Jornada sem nome"}</p>
      <ul className="last-journey__facts">
        <li>
          <PixelIcon name="person" /> <span className="visually-hidden">Personagem: </span>
          {journey.character_name ?? "sem personagem"}
        </li>
        <li>
          <PixelIcon name="pin" /> <span className="visually-hidden">Local: </span>
          {journey.location ?? "local desconhecido"}
          {journey.world_name ? `, ${journey.world_name}` : ""}
        </li>
        <li>
          <PixelIcon name="clock" /> Salvo em: {formatSavedAt(journey.last_saved_at ?? journey.created_at)}
        </li>
        <li>
          <PeriodLabel period={toPeriod(journey.day_period)} />
        </li>
      </ul>
      {notice ? (
        <div className="callout callout--warn">
          <p>
            <Badge tone="warn">Atenção</Badge> {notice}
          </p>
          <div className="actions">
            <Button size="sm" onClick={onJourneys}>
              Ver Jornadas
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
