import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { version as APP_VERSION } from "../package.json";
import { BackendError, canExitApp, exitApp, type BackendInfo } from "./api/backend";
import { closeJourney, openJourney, type JourneySnapshot, type JourneySummary } from "./api/journeys";
import { ChatView } from "./components/ChatView";
import { EngineNotice } from "./components/EngineNotice";
import { ModelsView, type ModelsViewProps } from "./components/ModelsView";
import { StatusIndicator } from "./components/StatusIndicator";
import { useBackend, type UseBackendOptions } from "./hooks/useBackend";
import { useChat } from "./hooks/useChat";
import { useEngineStatus } from "./hooks/useEngineStatus";
import { useCreationRules, useJourneyList } from "./hooks/useGameData";
import { describeError, openErrorMessage, toPeriod } from "./lib/format";
import { initialNav, navReducer, type Screen } from "./navigation";
import { JOURNEY_TABS, journeyTitle, ObjectivesTab, SheetTab, WorldTab, type JourneyTab } from "./screens/journey/JourneyTabs";
import { JourneysScreen } from "./screens/JourneysScreen";
import { MainMenu, pickLastJourney } from "./screens/MainMenu";
import { NewJourneyWizard } from "./screens/newJourney/NewJourneyWizard";
import { Button, PeriodLabel, PixelIcon, SkyBackdrop, TabPanel, Tabs } from "./ui";

const TAB_PREFIX = "jornada";

export interface AppProps {
  backendOptions?: UseBackendOptions;
  /** Intervalo de consulta do motor, em ms (os testes usam um valor curto). */
  enginePollMs?: number;
  copyText?: ModelsViewProps["copyText"];
}

/** Abre a Jornada; se o serviço ainda tiver outra aberta (por exemplo, depois de recarregar a tela), fecha e tenta de novo. */
async function openWithRetry(info: BackendInfo, id: string): Promise<JourneySnapshot> {
  try {
    return await openJourney(info, id);
  } catch (err) {
    if (err instanceof BackendError && err.code === "jornada_ja_aberta") {
      await closeJourney(info);
      return openJourney(info, id);
    }
    throw err;
  }
}

export function App({ backendOptions, enginePollMs, copyText }: AppProps = {}) {
  const status = useBackend(backendOptions);
  const info = status.kind === "connected" ? status.info : null;
  const engine = useEngineStatus(info, enginePollMs);
  const { refresh } = engine;
  const chat = useChat(info, { onEngineProblem: () => void refresh() });
  const { reset: resetChat } = chat;
  const rules = useCreationRules(info);
  const journeys = useJourneyList(info);
  const { reload: reloadJourneys } = journeys;
  const [nav, dispatch] = useReducer(navReducer, initialNav);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const lastOpenedId = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousScreen = useRef<Screen>(nav.screen);
  const canExit = canExitApp();

  // Foco no título da tela ao trocar de tela (não na primeira montagem).
  useEffect(() => {
    if (previousScreen.current === nav.screen) return;
    previousScreen.current = nav.screen;
    const heading = mainRef.current?.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }, [nav.screen]);

  // Ao voltar ao menu ou à lista, relê as Jornadas.
  useEffect(() => {
    if (nav.screen === "menu" || nav.screen === "jornadas") void reloadJourneys();
  }, [nav.screen, reloadJourneys]);

  // No Chat, confere de novo o estado do motor.
  useEffect(() => {
    if (nav.screen === "jornada" && nav.tab === "chat") void refresh();
  }, [nav.screen, nav.tab, refresh]);

  const open = useCallback(
    async (journey: Pick<JourneySummary, "id">, from: "menu" | "jornadas") => {
      if (!info) return;
      setOpening(journey.id);
      setOpenError(null);
      setMenuError(null);
      try {
        const snapshot = await openWithRetry(info, journey.id);
        if (lastOpenedId.current !== snapshot.journey.id) resetChat();
        lastOpenedId.current = snapshot.journey.id;
        dispatch({ type: "opened", snapshot });
      } catch (err) {
        const message = openErrorMessage(err);
        if (from === "menu") setMenuError(message);
        else setOpenError(message);
      } finally {
        setOpening(null);
      }
    },
    [info, resetChat],
  );

  const backToMenu = async () => {
    setMenuError(null);
    if (info) {
      try {
        await closeJourney(info);
      } catch (err) {
        setMenuError(`Não foi possível fechar a Jornada: ${describeError(err)}`);
      }
    }
    dispatch({ type: "closed" });
  };

  const onCreated = async (journey: JourneySummary) => {
    if (!info) return;
    try {
      const snapshot = await openWithRetry(info, journey.id);
      resetChat();
      lastOpenedId.current = snapshot.journey.id;
      dispatch({ type: "opened", snapshot });
    } catch (err) {
      dispatch({
        type: "go",
        screen: "jornadas",
        notice: `A Jornada “${journey.name ?? ""}” foi criada, mas não abriu: ${openErrorMessage(err)}`,
      });
    }
  };

  const onExit = () => {
    exitApp().catch((err: unknown) => setMenuError(`Não foi possível sair: ${describeError(err)}`));
  };

  const snapshot = nav.journey;
  const last = pickLastJourney(journeys.data);
  const period =
    nav.screen === "jornada" && snapshot ? toPeriod(snapshot.journey.day_period) : toPeriod(last?.day_period ?? null);
  const screen = nav.screen;

  const openModels = () => {
    dispatch({ type: "go", screen: "modelos" });
  };

  return (
    <div className={`app app--${screen}`}>
      {screen !== "menu" ? (
        <header className="app-bar">
          <p className="app-bar__brand">
            <PixelIcon name="star" size={24} className="app-bar__mark" />
            Henduran
          </p>
          <nav className="app-bar__nav" aria-label="Navegação">
            {screen === "jornada" ? (
              <Tabs
                items={JOURNEY_TABS}
                value={nav.tab}
                onChange={(tab: JourneyTab) => dispatch({ type: "tab", tab })}
                label="Seções da Jornada"
                idPrefix={TAB_PREFIX}
              />
            ) : null}
          </nav>
          <div className="app-bar__actions">
            {screen === "jornada" ? (
              <Button onClick={() => void backToMenu()}>
                <PixelIcon name="back" /> Menu
              </Button>
            ) : screen === "modelos" && nav.modelsBack === "jornada" ? (
              <Button onClick={() => dispatch({ type: "go", screen: "jornada" })}>
                <PixelIcon name="back" /> Voltar à Jornada
              </Button>
            ) : screen === "jornadas" || screen === "modelos" ? (
              <Button onClick={() => dispatch({ type: "go", screen: "menu" })}>
                <PixelIcon name="back" /> Menu
              </Button>
            ) : null}
          </div>
        </header>
      ) : null}

      <SkyBackdrop period={period} className={`app__sky app__sky--${screen}`} />

      <main ref={mainRef} className={`app__main app__main--${screen}`}>
        {screen === "menu" ? (
          <MainMenu
            connected={info !== null}
            list={journeys.data}
            listError={journeys.error}
            opening={opening !== null}
            openError={menuError}
            onContinue={(j) => void open(j, "menu")}
            onNew={() => dispatch({ type: "go", screen: "nova-jornada" })}
            onJourneys={() => dispatch({ type: "go", screen: "jornadas" })}
            onModels={openModels}
            canExit={canExit}
            onExit={onExit}
          />
        ) : null}

        {screen === "jornadas" && info ? (
          <div className="app__panel app__panel--scroll">
            <JourneysScreen
              info={info}
              list={journeys.data}
              loading={journeys.loading}
              error={journeys.error}
              reload={reloadJourneys}
              onOpen={(j) => void open(j, "jornadas")}
              opening={opening}
              openError={openError}
              notice={nav.notice}
            />
          </div>
        ) : null}

        {screen === "nova-jornada" && info ? (
          rules.rules && rules.schema ? (
            <NewJourneyWizard
              info={info}
              rules={rules.rules}
              schema={rules.schema}
              onCreated={onCreated}
              onCancel={() => dispatch({ type: "go", screen: "menu" })}
            />
          ) : (
            <div className="app__panel app__panel--scroll">
              <h2 className="screen-title">Nova Jornada</h2>
              {rules.error ? (
                <div className="callout callout--danger" role="alert">
                  <p>{rules.error}</p>
                  <div className="actions">
                    <Button size="sm" onClick={rules.reload}>
                      Tentar de novo
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="hint">Carregando as regras de criação…</p>
              )}
            </div>
          )
        ) : null}

        {screen === "modelos" ? (
          <div className="app__panel app__panel--scroll">
            {info ? (
              <ModelsView
                info={info}
                engine={engine.status}
                engineError={engine.error}
                onEngineChange={engine.setStatus}
                refreshEngine={engine.refresh}
                {...(copyText ? { copyText } : {})}
              />
            ) : (
              <p className="app__waiting">Esperando o serviço local ficar pronto…</p>
            )}
          </div>
        ) : null}

        {screen === "jornada" && snapshot ? (
          <div className="journey">
            <header className="journey__header px-frame">
              <h2 className="journey__title">Jornada: {journeyTitle(snapshot)}</h2>
              {snapshot.world.content ? <p className="hint">Mundo: {snapshot.world.content.name}</p> : null}
            </header>
            <TabPanel idPrefix={TAB_PREFIX} id="chat" selected={nav.tab === "chat"} className="app__panel journey__chat">
              <ChatView
                entries={chat.entries}
                streaming={chat.streaming}
                error={chat.error}
                disabled={info === null}
                onSend={(text) => void chat.send(text)}
                onCancel={chat.cancel}
                notice={
                  <>
                    <p className="journey__aside">
                      O Narrador ainda não recebe o contexto da sua Jornada. Isso virá numa etapa seguinte.
                    </p>
                    <EngineNotice status={engine.status} onOpenModels={openModels} />
                  </>
                }
              />
            </TabPanel>
            <TabPanel idPrefix={TAB_PREFIX} id="ficha" selected={nav.tab === "ficha"} className="app__panel app__panel--scroll">
              {nav.tab === "ficha" ? <SheetTab character={snapshot.character} rules={rules.rules} /> : null}
            </TabPanel>
            <TabPanel idPrefix={TAB_PREFIX} id="mundo" selected={nav.tab === "mundo"} className="app__panel app__panel--scroll">
              {nav.tab === "mundo" ? <WorldTab world={snapshot.world.content} location={snapshot.journey.location} /> : null}
            </TabPanel>
            <TabPanel
              idPrefix={TAB_PREFIX}
              id="objetivos"
              selected={nav.tab === "objetivos"}
              className="app__panel app__panel--scroll"
            >
              {nav.tab === "objetivos" ? <ObjectivesTab character={snapshot.character} /> : null}
            </TabPanel>
          </div>
        ) : null}
      </main>

      <footer className="status-bar">
        <StatusIndicator status={status} />
        {screen === "jornada" && snapshot ? (
          <>
            <p className="status-bar__item">
              <PixelIcon name="pin" className="status-bar__icon" />
              <span className="visually-hidden">Local: </span>
              {snapshot.journey.location ?? "local desconhecido"}
            </p>
            <p className="status-bar__item">
              <PixelIcon name="person" className="status-bar__icon" />
              <span className="visually-hidden">Personagem: </span>
              {snapshot.journey.character_name ?? snapshot.character?.name ?? "sem personagem"}
            </p>
          </>
        ) : null}
        <p className="status-bar__item">
          <PeriodLabel period={period} />
        </p>
        {screen === "menu" ? (
          <p className="status-bar__item status-bar__tagline">
            Henduran v{APP_VERSION} · RPG solo guiado por IA
          </p>
        ) : null}
      </footer>
    </div>
  );
}
