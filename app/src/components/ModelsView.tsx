import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { ACTIVE_DOWNLOAD_STATES, cancelDownload, forgetDownload, retryDownload } from "../api/hub";
import {
  fetchHardware,
  fetchModels,
  fetchSuggestions,
  removeModel,
  selectModel,
  setModelHidden,
  startEngine,
  stopEngine,
  type EngineStatus,
  type HardwareInfo,
  type LocalModel,
  type ModelOptions,
  type ModelSuggestion,
  type ModelsResponse,
} from "../api/engine";
import { useDownloads } from "../hooks/useDownloads";
import { Button, Dialog, TabPanel, Tabs, tabId } from "../ui";
import { DownloadsPane } from "./models/DownloadsPane";
import { LoadModelDialog } from "./models/LoadModelDialog";
import { ModelsPane } from "./models/ModelsPane";
import { describe, displayName } from "./models/modelsText";
import { PcPane } from "./models/PcPane";
import { StatusHeader } from "./models/StatusHeader";

import "./models/Models.css";

export interface ModelsViewProps {
  info: BackendInfo;
  engine: EngineStatus | null;
  engineError: string | null;
  onEngineChange: (status: EngineStatus) => void;
  refreshEngine: () => Promise<EngineStatus | null>;
  /** Copia texto para a área de transferência (injetável nos testes). */
  copyText?: (text: string) => Promise<void>;
  /** Intervalo de consulta dos downloads ativos, em ms (os testes usam um valor curto). */
  downloadsPollMs?: number;
}

type ModelsTab = "modelos" | "pc" | "downloads";

/**
 * Tela Modelos (docs/ui-ux/14-modelos.md): cabeçalho com o estado do PC, do motor e do
 * Narrador e um cartão com as abas Modelos, Procurar neste PC e Downloads. O mesmo conteúdo
 * serve ao menu inicial, à tela da Jornada e ao diálogo Configurar modelo da Nova Jornada.
 */
const defaultCopy = (text: string) => navigator.clipboard.writeText(text);

export function ModelsView({
  info,
  engine,
  engineError,
  onEngineChange,
  refreshEngine,
  copyText = defaultCopy,
  downloadsPollMs,
}: ModelsViewProps) {
  const ids = useId();
  const tabsId = `${ids}-tabs`;
  const [tab, setTab] = useState<ModelsTab>("modelos");
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ModelSuggestion[] | null>(null);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [loadTarget, setLoadTarget] = useState<LocalModel | null>(null);
  const [removing, setRemoving] = useState<{ model: LocalModel; sending: boolean } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [completed, setCompleted] = useState(0);
  const [showMine, setShowMine] = useState(0);
  const [engineDownloadToken, setEngineDownloadToken] = useState(0);
  const mineHeading = useRef<HTMLHeadingElement>(null);
  const cancelRemoveRef = useRef<HTMLButtonElement>(null);

  const loadModels = useCallback(async () => {
    try {
      setModels(await fetchModels(info));
      setModelsError(null);
    } catch (error) {
      setModelsError(describe(error));
    }
  }, [info]);

  const downloads = useDownloads(info, {
    ...(downloadsPollMs !== undefined ? { pollMs: downloadsPollMs } : {}),
    onCompleted: () => {
      setCompleted((n) => n + 1);
      void loadModels();
    },
  });

  useEffect(() => {
    let active = true;
    fetchHardware(info)
      .then((hw) => active && setHardware(hw))
      .catch((error: unknown) => active && setHardwareError(describe(error)));
    fetchSuggestions(info)
      .then((out) => {
        if (!active) return;
        setSuggestions(out.suggestions);
        setSearchTerms(out.search_terms);
      })
      .catch(() => active && setSuggestions([]));
    void loadModels();
    return () => {
      active = false;
    };
  }, [info, loadModels]);

  const goTab = (next: ModelsTab) => {
    setTab(next);
    requestAnimationFrame(() => document.getElementById(tabId(tabsId, next))?.focus());
  };

  const selected = models?.models.find((m) => m.id === (engine?.active_model ?? models.active)) ?? null;

  /* ------------------------------------------------------------ ações */
  const run = async (id: string | null, action: () => Promise<void>) => {
    setActionError(null);
    setPendingModel(id ?? "__engine__");
    try {
      await action();
    } catch (error) {
      setActionError(describe(error));
      await refreshEngine();
    } finally {
      setPendingModel(null);
    }
  };

  const confirmLoad = async (model: LocalModel, options: ModelOptions) => {
    // Erros aparecem no próprio diálogo (que continua aberto).
    await selectModel(info, model.id, options);
    onEngineChange(await startEngine(info));
    setLoadTarget(null);
    setNotice(`Carregando ${displayName(model.name)}…`);
    void loadModels();
  };

  const unload = () =>
    void run(null, async () => {
      onEngineChange(await stopEngine(info));
      setNotice("Modelo descarregado. O Narrador não responde até carregar um modelo.");
    });

  const retry = () =>
    void run(null, async () => {
      onEngineChange(await startEngine(info));
    });

  const toggleHidden = (model: LocalModel) =>
    void run(model.id, async () => {
      const hide = !model.hidden;
      await setModelHidden(info, model.id, hide);
      // Como no protótipo: ocultar o modelo carregado também o descarrega.
      if (hide && engine?.active_model === model.id && (engine.state === "ready" || engine.state === "starting")) {
        onEngineChange(await stopEngine(info));
      }
      setNotice(hide ? `${displayName(model.name)} foi para Ocultos.` : `${displayName(model.name)} voltou para a lista.`);
      await loadModels();
    });

  const confirmRemove = async (model: LocalModel) => {
    setActionError(null);
    setRemoving({ model, sending: true });
    try {
      await removeModel(info, model.id);
      setNotice(`${displayName(model.name)} foi apagado do disco.`);
      await refreshEngine();
    } catch (error) {
      setActionError(describe(error));
    } finally {
      await loadModels();
      setRemoving(null);
    }
  };

  const activeDownloads = downloads.downloads.filter((d) => ACTIVE_DOWNLOAD_STATES.has(d.state)).length;

  return (
    <section className="models mdl" aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className="visually-hidden">
        Modelos
      </h2>

      <StatusHeader
        info={info}
        engine={engine}
        engineError={engineError}
        hardware={hardware}
        hardwareError={hardwareError}
        selected={selected}
        onEngineChange={onEngineChange}
        onLoad={setLoadTarget}
        onUnload={unload}
        onRetry={retry}
        busy={pendingModel !== null}
        openDownloadToken={engineDownloadToken}
      />

      {actionError ? (
        <p className="callout callout--danger" role="alert">
          Erro: {actionError}
        </p>
      ) : null}
      <p className="visually-hidden" aria-live="polite">
        {notice}
      </p>

      <section className="mdl-card surface-parchment" aria-label="Modelos, procura e downloads">
        <Tabs<ModelsTab>
          items={[
            { id: "modelos", label: "Modelos" },
            { id: "pc", label: "Procurar neste PC" },
            {
              id: "downloads",
              label: (
                <>
                  Downloads
                  {activeDownloads ? (
                    <>
                      {" "}
                      <span className="mdl-tab-badge" aria-hidden="true">
                        {activeDownloads}
                      </span>
                      <span className="visually-hidden">
                        ({activeDownloads} {activeDownloads === 1 ? "ativo" : "ativos"})
                      </span>
                    </>
                  ) : null}
                </>
              ),
            },
          ]}
          value={tab}
          onChange={setTab}
          label="Partes da tela Modelos"
          idPrefix={tabsId}
          className="mdl-tabs"
        />
        <TabPanel idPrefix={tabsId} id="modelos" selected={tab === "modelos"} className="mdl-pane">
          <ModelsPane
            info={info}
            models={models}
            modelsError={modelsError}
            engine={engine}
            suggestions={suggestions}
            searchTerms={searchTerms}
            pendingModel={pendingModel}
            onLoad={setLoadTarget}
            onUnload={unload}
            onToggleHidden={toggleHidden}
            onDelete={(model) => setRemoving({ model, sending: false })}
            onDownloadStarted={downloads.upsert}
            onEngineDownload={() => setEngineDownloadToken((n) => n + 1)}
            onGoTab={goTab}
            showMineToken={showMine}
            refreshToken={completed}
            mineHeadingRef={mineHeading}
          />
        </TabPanel>
        <TabPanel idPrefix={tabsId} id="pc" selected={tab === "pc"} className="mdl-pane">
          <PcPane info={info} onChange={() => void loadModels()} copyText={copyText} />
        </TabPanel>
        <TabPanel idPrefix={tabsId} id="downloads" selected={tab === "downloads"} className="mdl-pane">
          <DownloadsPane
            downloads={downloads.downloads}
            error={downloads.error}
            onCancel={async (id) => {
              downloads.upsert(await cancelDownload(info, id));
            }}
            onRetry={async (id) => {
              downloads.upsert(await retryDownload(info, id));
            }}
            onForget={async (id) => {
              await forgetDownload(info, id);
              downloads.drop(id);
            }}
            onShowMine={() => {
              setShowMine((n) => n + 1);
              goTab("modelos");
            }}
          />
        </TabPanel>
      </section>

      <LoadModelDialog info={info} model={loadTarget} onClose={() => setLoadTarget(null)} onConfirm={confirmLoad} />

      <Dialog
        open={removing !== null}
        tone="danger"
        title={`Apagar ${removing ? displayName(removing.model.name) : ""} do disco?`}
        description={
          <p>
            Isto apaga o arquivo
            {removing && removing.model.parts > 1 ? ` (todas as ${removing.model.parts} partes)` : ""} do disco e não
            pode ser desfeito. Para usar de novo, será preciso baixar outra vez.
          </p>
        }
        onClose={() => {
          if (!removing?.sending) setRemoving(null);
        }}
        dismissible={!removing?.sending}
        initialFocusRef={cancelRemoveRef}
        returnFocusRef={mineHeading}
        actions={
          <>
            <Button ref={cancelRemoveRef} disabled={removing?.sending} onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={removing?.sending ?? false}
              onClick={() => removing && void confirmRemove(removing.model)}
            >
              Apagar do disco
            </Button>
          </>
        }
      />
    </section>
  );
}
