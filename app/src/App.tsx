import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { version as APP_VERSION } from "../package.json";
import { BackendError, canExitApp, exitApp, type BackendInfo } from "./api/backend";
import { portraitErrorMessage, uploadPortrait } from "./api/journeyScreen";
import { closeJourney, openJourney, type JourneySnapshot, type JourneySummary } from "./api/journeys";
import { ModelsView, type ModelsViewProps } from "./components/ModelsView";
import { useBackend, type UseBackendOptions } from "./hooks/useBackend";
import { useEngineStatus } from "./hooks/useEngineStatus";
import { useCreationRules, useJourneyList } from "./hooks/useGameData";
import { describeError, openErrorMessage, toPeriod } from "./lib/format";
import { initialNav, navReducer, type Screen } from "./navigation";
import { JourneyScreen, type PortraitRetry } from "./screens/journey/JourneyScreen";
import { JourneysScreen } from "./screens/JourneysScreen";
import { WorldsScreen } from "./screens/WorldsScreen";
import { MainMenu, pickLastJourney } from "./screens/MainMenu";
import { ServiceIndicator } from "./screens/ServiceIndicator";
import { NewJourneyWizard, type CreatedExtras } from "./screens/newJourney/NewJourneyWizard";
import { Button, PeriodLabel, PixelIcon, SkyBackdrop } from "./ui";

export interface AppProps {
  backendOptions?: UseBackendOptions;
  /** Intervalo de consulta do motor, em ms (os testes usam um valor curto). */
  enginePollMs?: number;
  copyText?: ModelsViewProps["copyText"];
  /** Cópia das mensagens da Jornada (os testes trocam a área de transferência). */
  copyMessage?: (text: string) => Promise<void>;
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

export function App({ backendOptions, enginePollMs, copyText, copyMessage }: AppProps = {}) {
  const status = useBackend(backendOptions);
  const info = status.kind === "connected" ? status.info : null;
  const engine = useEngineStatus(info, enginePollMs);
  const { refresh } = engine;
  const rules = useCreationRules(info);
  const journeys = useJourneyList(info);
  const { reload: reloadJourneys } = journeys;
  const [nav, dispatch] = useReducer(navReducer, initialNav);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  /** Retrato da Nova Jornada que não foi enviado (a tela da Jornada avisa e deixa tentar de novo). */
  const [portraitRetry, setPortraitRetry] = useState<PortraitRetry | null>(null);
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

  // Na Jornada e ao voltar ao menu (indicador do rodapé), confere de novo o estado do motor.
  useEffect(() => {
    if (nav.screen === "jornada" || nav.screen === "menu") void refresh();
  }, [nav.screen, refresh]);

  const open = useCallback(
    async (journey: Pick<JourneySummary, "id">, from: "menu" | "jornadas") => {
      if (!info) return;
      setOpening(journey.id);
      setOpenError(null);
      setMenuError(null);
      try {
        const snapshot = await openWithRetry(info, journey.id);
        setPortraitRetry(null);
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
    [info],
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

  const onCreated = async (journey: JourneySummary, extras: CreatedExtras = {}) => {
    if (!info) return;
    try {
      let snapshot = await openWithRetry(info, journey.id);
      // Retrato escolhido no assistente: vai ao serviço (que confere os bytes) com a Jornada já aberta.
      // Se falhar, a Jornada abre sem retrato e a tela avisa (Tentar de novo ou Escolher outro na ficha).
      let retry: PortraitRetry | null = null;
      if (extras.portrait && snapshot.character) {
        try {
          const portrait = await uploadPortrait(info, extras.portrait.file, extras.portrait.crop);
          snapshot = { ...snapshot, character: { ...snapshot.character, portrait } };
        } catch (err) {
          const reason = portraitErrorMessage(err);
          retry = { ...extras.portrait, reason: /[.!?]$/.test(reason) ? reason : `${reason}.` };
        }
      }
      setPortraitRetry(retry);
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
  // O assistente fica montado enquanto Modelos está aberto, para não perder o preenchimento.
  const showWizard =
    info !== null && (screen === "nova-jornada" || (screen === "modelos" && nav.modelsBack === "nova-jornada"));

  return (
    <div className={`app app--${screen}`}>
      {screen !== "menu" && screen !== "jornada" ? (
        <header className="app-bar">
          <p className="app-bar__brand">
            <PixelIcon name="star" size={24} className="app-bar__mark" />
            Henduran
          </p>
          <div className="app-bar__nav" />
          <div className="app-bar__actions">
            {screen === "modelos" && nav.modelsBack === "nova-jornada" ? (
              <Button onClick={() => dispatch({ type: "go", screen: "nova-jornada" })}>
                <PixelIcon name="back" /> Voltar à criação
              </Button>
            ) : screen === "modelos" && nav.modelsBack === "jornada" ? (
              <Button onClick={() => dispatch({ type: "go", screen: "jornada" })}>
                <PixelIcon name="back" /> Voltar à Jornada
              </Button>
            ) : screen === "jornadas" || screen === "mundos" || screen === "modelos" ? (
              <Button onClick={() => dispatch({ type: "go", screen: "menu" })}>
                <PixelIcon name="back" /> Menu
              </Button>
            ) : null}
          </div>
        </header>
      ) : null}

      {/* No menu, a paisagem viva é do próprio menu; na Jornada, o céu fica na barra. */}
      {screen !== "jornada" && screen !== "menu" ? <SkyBackdrop period={period} className={`app__sky app__sky--${screen}`} /> : null}

      <main ref={mainRef} className={`app__main app__main--${screen}`}>
        {screen === "menu" ? (
          <MainMenu
            backend={status}
            engine={engine.status}
            version={APP_VERSION}
            list={journeys.data}
            listError={journeys.error}
            opening={opening !== null}
            openError={menuError}
            onContinue={(j) => void open(j, "menu")}
            onNew={() => dispatch({ type: "go", screen: "nova-jornada" })}
            onJourneys={() => dispatch({ type: "go", screen: "jornadas" })}
            onWorlds={() => dispatch({ type: "go", screen: "mundos" })}
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

        {screen === "mundos" && info ? (
          rules.schema ? (
            <WorldsScreen info={info} schema={rules.schema} />
          ) : (
            <div className="app__panel app__panel--scroll">
              <h2 className="screen-title">Mundos</h2>
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
                <p className="hint">Carregando o esquema do Mundo…</p>
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

        {showWizard && info ? (
          rules.rules && rules.schema ? (
            <div className="app__wizard" hidden={screen === "modelos"}>
              <NewJourneyWizard
                info={info}
                rules={rules.rules}
                schema={rules.schema}
                onCreated={onCreated}
                engine={engine.status}
                modelsPanel={
                  <ModelsView
                    info={info}
                    engine={engine.status}
                    engineError={engine.error}
                    onEngineChange={engine.setStatus}
                    refreshEngine={engine.refresh}
                    {...(copyText ? { copyText } : {})}
                  />
                }
                onCancel={() => dispatch({ type: "go", screen: "menu" })}
              />
            </div>
          ) : screen === "nova-jornada" ? (
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
          ) : null
        ) : null}

        {screen === "jornada" && snapshot && info ? (
          <JourneyScreen
            key={snapshot.journey.id}
            info={info}
            snapshot={snapshot}
            rules={rules.rules}
            engine={engine.status}
            onEngineProblem={() => void refresh()}
            onOpenModels={openModels}
            onBackToMenu={() => {
              setPortraitRetry(null);
              void backToMenu();
            }}
            portraitRetry={portraitRetry}
            onJourneyChanged={(journey) => dispatch({ type: "summary", journey })}
            {...(copyMessage ? { copyText: copyMessage } : {})}
          />
        ) : null}
      </main>

      {screen !== "jornada" && screen !== "menu" ? (
        <footer className="status-bar">
          <p className="status-bar__item status-bar__period">
            <PeriodLabel period={period} />
          </p>
          <ServiceIndicator className="status-bar__service" backend={status} engine={engine.status} onModels={openModels} />
        </footer>
      ) : null}
    </div>
  );
}
