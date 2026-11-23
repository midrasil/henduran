import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { ChatView } from "./components/ChatView";
import { EngineNotice } from "./components/EngineNotice";
import { ModelsView, type ModelsViewProps } from "./components/ModelsView";
import { StatusIndicator } from "./components/StatusIndicator";
import { useBackend, type UseBackendOptions } from "./hooks/useBackend";
import { useChat } from "./hooks/useChat";
import { useEngineStatus } from "./hooks/useEngineStatus";

type Tab = "chat" | "models";

const TABS: { id: Tab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "models", label: "Modelos" },
];

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
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ chat: null, models: null });

  const selectTab = useCallback(
    (next: Tab, focus = false) => {
      setTab(next);
      if (focus) tabRefs.current[next]?.focus();
    },
    [],
  );

  // Ao voltar para o Chat, confere de novo o estado do motor.
  useEffect(() => {
    if (tab === "chat") void refresh();
  }, [tab, refresh]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    const target = next === null ? undefined : TABS[next];
    if (!target) return;
    event.preventDefault();
    selectTab(target.id, true);
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Henduran</h1>
        <StatusIndicator status={status} />
      </header>
      <nav className="tabs" aria-label="Seções">
        <div role="tablist" aria-label="Seções do Henduran" className="tabs__list">
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`tabs__tab${tab === t.id ? " tabs__tab--active" : ""}`}
              onClick={() => selectTab(t.id)}
              onKeyDown={onTabKeyDown}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="app__main">
        <div
          role="tabpanel"
          id="panel-chat"
          aria-labelledby="tab-chat"
          className="app__panel"
          hidden={tab !== "chat"}
        >
          <ChatView
            entries={chat.entries}
            streaming={chat.streaming}
            error={chat.error}
            disabled={info === null}
            onSend={(text) => void chat.send(text)}
            onCancel={chat.cancel}
            notice={<EngineNotice status={engine.status} onOpenModels={() => selectTab("models", true)} />}
          />
        </div>
        <div
          role="tabpanel"
          id="panel-models"
          aria-labelledby="tab-models"
          className="app__panel app__panel--scroll"
          hidden={tab !== "models"}
        >
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
              <p>Esperando o serviço local ficar pronto…</p>
            )
          ) : null}
        </div>
      </main>
    </div>
  );
}
