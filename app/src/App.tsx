import { ChatView } from "./components/ChatView";
import { StatusIndicator } from "./components/StatusIndicator";
import { useBackend, type UseBackendOptions } from "./hooks/useBackend";
import { useChat } from "./hooks/useChat";

export function App({ backendOptions }: { backendOptions?: UseBackendOptions } = {}) {
  const status = useBackend(backendOptions);
  const info = status.kind === "connected" ? status.info : null;
  const chat = useChat(info);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Henduran</h1>
        <StatusIndicator status={status} />
      </header>
      <main className="app__main">
        <ChatView
          entries={chat.entries}
          streaming={chat.streaming}
          error={chat.error}
          disabled={info === null}
          onSend={(text) => void chat.send(text)}
          onCancel={chat.cancel}
        />
      </main>
    </div>
  );
}
