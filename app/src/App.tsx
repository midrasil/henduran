import { useCallback, useEffect, useState } from "react";

import { ChatView } from "./components/ChatView";
import { EngineNotice } from "./components/EngineNotice";
import { ModelsView, type ModelsViewProps } from "./components/ModelsView";
import { StatusIndicator } from "./components/StatusIndicator";
import { useBackend, type UseBackendOptions } from "./hooks/useBackend";
import { useChat } from "./hooks/useChat";
import { useEngineStatus } from "./hooks/useEngineStatus";
import { DEFAULT_PERIOD, PeriodLabel, PixelIcon, SkyBackdrop, TabPanel, Tabs, tabId, type DayPeriod } from "./ui";

type Tab = "chat" | "models";

const TABS = [
  { id: "chat" as const, label: "Chat", icon: <PixelIcon name="chat" /> },
  { id: "models" as const, label: "Modelos", icon: <PixelIcon name="gem" /> },
];

const TAB_PREFIX = "app";

export interface AppProps {
  backendOptions?: UseBackendOptions;
  /** Intervalo de consulta do motor, em ms (os testes usam um valor curto). */
  enginePollMs?: number;
  copyText?: ModelsViewProps["copyText"];
}

export function App({ backendOptions, enginePollMs, copyText }: AppProps = {}) {
  const status = useBackend(backendOptions);
  const info = status.kind === "connected" ? status.info : null;
  const engine = useEngineStatus(info, enginePollMs);
  const { refresh } = engine;
  const chat = useChat(info, { onEngineProblem: () => void refresh() });
  const [tab, setTab] = useState<Tab>("chat");
  // Período do dia é estado do mundo (não o relógio real). Sem Jornada, o padrão.
  const [period] = useState<DayPeriod>(DEFAULT_PERIOD);

  const openModels = useCallback(() => {
    setTab("models");
    document.getElementById(tabId(TAB_PREFIX, "models"))?.focus();
  }, []);

  // Ao voltar para o Chat, confere de novo o estado do motor.
  useEffect(() => {
    if (tab === "chat") void refresh();
  }, [tab, refresh]);

  return (
    <div className="app">
      <header className="app-bar">
        <h1 className="app-bar__brand">
          <PixelIcon name="star" size={24} className="app-bar__mark" />
          Henduran
        </h1>
        <nav className="app-bar__nav" aria-label="Seções">
          <Tabs items={TABS} value={tab} onChange={setTab} label="Seções do Henduran" idPrefix={TAB_PREFIX} />
        </nav>
      </header>

      <SkyBackdrop period={period} className="app__sky" />

      <main className="app__main">
        <TabPanel idPrefix={TAB_PREFIX} id="chat" selected={tab === "chat"} className="app__panel">
          <ChatView
            entries={chat.entries}
            streaming={chat.streaming}
            error={chat.error}
            disabled={info === null}
            onSend={(text) => void chat.send(text)}
            onCancel={chat.cancel}
            notice={<EngineNotice status={engine.status} onOpenModels={openModels} />}
          />
        </TabPanel>
        <TabPanel idPrefix={TAB_PREFIX} id="models" selected={tab === "models"} className="app__panel app__panel--scroll">
          {tab === "models" ? (
            info ? (
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
            )
          ) : null}
        </TabPanel>
      </main>

      <footer className="status-bar">
        <StatusIndicator status={status} />
        <p className="status-bar__item">
          <PeriodLabel period={period} />
        </p>
      </footer>
    </div>
  );
}
