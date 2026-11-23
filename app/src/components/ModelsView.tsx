import { useCallback, useEffect, useId, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { cancelDownload, forgetDownload, retryDownload } from "../api/hub";
import {
  fetchEngineRelease,
  fetchHardware,
  fetchModels,
  FIT_LABEL,
  formatBytes,
  installEngine,
  removeModel,
  selectModel,
  startEngine,
  STATE_LABEL,
  stopEngine,
  type EngineRelease,
  type EngineStatus,
  type EngineVariant,
  type HardwareInfo,
  type ModelsResponse,
} from "../api/engine";
import { useDownloads } from "../hooks/useDownloads";
import { DownloadsPanel } from "./DownloadsPanel";
import { HubSearch } from "./HubSearch";
import { ModelFolders } from "./ModelFolders";

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

type DownloadStep =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "confirm"; release: EngineRelease; acknowledged: boolean }
  | { kind: "sending"; release: EngineRelease };

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "falha desconhecida";
}

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
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [variant, setVariant] = useState<EngineVariant>("vulkan");
  const [download, setDownload] = useState<DownloadStep>({ kind: "idle" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; sending: boolean } | null>(null);
  const [removedNotice, setRemovedNotice] = useState("");
  const [completed, setCompleted] = useState(0);
  const ids = useId();

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
    void loadModels();
    return () => {
      active = false;
    };
  }, [info, loadModels]);

  const state = engine?.state ?? "stopped";
  const installed = engine?.installed ?? false;
  const downloading = state === "downloading";

  const askDownload = async () => {
    setActionError(null);
    setDownload({ kind: "checking" });
    try {
      const release = await fetchEngineRelease(info, variant);
      setDownload({ kind: "confirm", release, acknowledged: false });
    } catch (error) {
      setDownload({ kind: "idle" });
      setActionError(describe(error));
    }
  };

  const confirmDownload = async (release: EngineRelease) => {
    setDownload({ kind: "sending", release });
    try {
      const status = await installEngine(info, release.variant, !release.verifiable);
      onEngineChange(status);
      setDownload({ kind: "idle" });
    } catch (error) {
      setDownload({ kind: "idle" });
      setActionError(describe(error));
    }
  };

  const chooseModel = async (id: string) => {
    setActionError(null);
    setPendingModel(id);
    try {
      await selectModel(info, id);
      onEngineChange(await startEngine(info));
    } catch (error) {
      setActionError(describe(error));
      await refreshEngine();
    } finally {
      setPendingModel(null);
      void loadModels();
    }
  };

  const stop = async () => {
    setActionError(null);
    try {
      onEngineChange(await stopEngine(info));
    } catch (error) {
      setActionError(describe(error));
    }
  };

  const confirmRemove = async (id: string, name: string) => {
    setActionError(null);
    setRemoving({ id, sending: true });
    try {
      await removeModel(info, id);
      setRemovedNotice(`${name} foi apagado do disco.`);
      await refreshEngine();
    } catch (error) {
      setActionError(describe(error));
    } finally {
      setRemoving(null);
      void loadModels();
    }
  };

  const copyPath = async (path: string) => {
    try {
      await copyText(path);
      setCopied("Caminho copiado.");
    } catch {
      setCopied("Não foi possível copiar. Selecione o caminho e copie manualmente.");
    }
  };

  const engineLine = engine
    ? `${STATE_LABEL[state]}${engine.message && engine.message !== STATE_LABEL[state] ? `: ${engine.message}` : ""}`
    : engineError
      ? `Não foi possível consultar o motor: ${engineError}`
      : "Consultando o motor…";

  return (
    <section className="models" aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className="models__title">
        Modelos
      </h2>

      {/* Hardware */}
      <section className="panel" aria-labelledby={`${ids}-hw`}>
        <h3 id={`${ids}-hw`}>Hardware deste PC</h3>
        {hardwareError ? (
          <p className="panel__error">Não foi possível ler o hardware: {hardwareError}</p>
        ) : !hardware ? (
          <p>Lendo o hardware…</p>
        ) : (
          <dl className="facts">
            <dt>Placa de vídeo</dt>
            <dd>
              {hardware.gpus.length === 0 ? (
                "Nenhuma placa de vídeo encontrada"
              ) : (
                <ul className="facts__list">
                  {hardware.gpus.map((gpu, index) => (
                    <li key={`${gpu.name}-${index}`}>
                      {gpu.name} — {gpu.memory_bytes > 0 ? formatBytes(gpu.memory_bytes) : "memória desconhecida"}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt>Memória RAM</dt>
            <dd>{hardware.ram_bytes > 0 ? formatBytes(hardware.ram_bytes) : "desconhecida"}</dd>
            <dt>Processador</dt>
            <dd>{hardware.cpu || "desconhecido"}</dd>
          </dl>
        )}
      </section>

      {/* Motor */}
      <section className="panel" aria-labelledby={`${ids}-engine`}>
        <h3 id={`${ids}-engine`}>Motor de IA</h3>
        <p className={`engine-state engine-state--${state}`} role="status" aria-live="polite">
          {engineLine}
        </p>
        {installed && engine?.version ? (
          <p>
            Versão {engine.version}
            {engine.variant ? ` (${engine.variant === "cpu" ? "CPU" : "Vulkan"})` : ""}
            {engine.verified === false ? " — instalado sem verificação de integridade" : ""}
          </p>
        ) : null}
        {downloading ? (
          <progress
            className="progress"
            aria-label="Progresso do download do motor"
            max={1}
            value={engine?.progress ?? 0}
          />
        ) : null}

        {!installed && !downloading ? (
          download.kind === "confirm" || download.kind === "sending" ? (
            <div className="confirm" role="group" aria-labelledby={`${ids}-confirm`}>
              <p id={`${ids}-confirm`} className="confirm__title">
                Baixar {download.release.name} ({formatBytes(download.release.size)}), versão{" "}
                {download.release.tag}, dos releases oficiais do llama.cpp no GitHub?
              </p>
              {!download.release.verifiable ? (
                <>
                  <p className="warning" role="alert">
                    Atenção: o GitHub não publicou o SHA-256 deste arquivo, então não é possível verificar se ele
                    chegou íntegro. Só continue se aceitar esse risco.
                  </p>
                  {download.kind === "confirm" ? (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={download.acknowledged}
                        onChange={(event) =>
                          setDownload({ ...download, acknowledged: event.target.checked })
                        }
                      />
                      Entendo o risco e quero baixar sem verificação
                    </label>
                  ) : null}
                </>
              ) : (
                <p>A integridade do arquivo será conferida pelo SHA-256 publicado.</p>
              )}
              <div className="actions">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={
                    download.kind === "sending" || (!download.release.verifiable && !download.acknowledged)
                  }
                  onClick={() => void confirmDownload(download.release)}
                >
                  Confirmar download
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={download.kind === "sending"}
                  onClick={() => setDownload({ kind: "idle" })}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="download">
              <fieldset className="variants">
                <legend>Variante do motor</legend>
                <label className="check">
                  <input
                    type="radio"
                    name={`${ids}-variant`}
                    value="vulkan"
                    checked={variant === "vulkan"}
                    onChange={() => setVariant("vulkan")}
                  />
                  Vulkan (padrão; usa a placa de vídeo AMD, NVIDIA ou Intel)
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name={`${ids}-variant`}
                    value="cpu"
                    checked={variant === "cpu"}
                    onChange={() => setVariant("cpu")}
                  />
                  CPU (só o processador; mais lento)
                </label>
              </fieldset>
              <button
                type="button"
                className="button button--primary"
                disabled={download.kind === "checking"}
                onClick={() => void askDownload()}
              >
                {download.kind === "checking" ? "Consultando o tamanho…" : "Baixar o motor de IA"}
              </button>
            </div>
          )
        ) : null}

        {installed && (state === "ready" || state === "starting") ? (
          <div className="actions">
            <button type="button" className="button button--secondary" onClick={() => void stop()}>
              Parar o motor
            </button>
          </div>
        ) : null}

        {state === "error" && engine ? (
          <div className="engine-error">
            {engine.log ? (
              <>
                <p className="engine-error__title">Final do log do motor:</p>
                <pre className="log" tabIndex={0} aria-label="Final do log do motor">
                  {engine.log}
                </pre>
              </>
            ) : null}
          </div>
        ) : null}

        {actionError ? (
          <p className="panel__error" role="alert">
            Erro: {actionError}
          </p>
        ) : null}
      </section>

      {/* Modelos locais */}
      <section className="panel" aria-labelledby={`${ids}-models`}>
        <h3 id={`${ids}-models`}>Modelos locais</h3>
        {modelsError ? (
          <p className="panel__error">Não foi possível listar os modelos: {modelsError}</p>
        ) : !models ? (
          <p>Procurando modelos…</p>
        ) : models.models.length === 0 ? (
          <div className="empty">
            <p>
              Nenhum modelo .gguf encontrado. Busque e baixe um modelo abaixo, adicione uma pasta onde você já tem
              modelos ou coloque um arquivo .gguf nesta pasta e atualize a lista:
            </p>
            <p>
              <code className="path">{models.models_dir}</code>
            </p>
            <div className="actions">
              <button type="button" className="button button--secondary" onClick={() => void copyPath(models.models_dir)}>
                Copiar caminho
              </button>
              <button type="button" className="button button--secondary" onClick={() => void loadModels()}>
                Atualizar lista
              </button>
            </div>
            <p className="hint" aria-live="polite">
              {copied ?? ""}
            </p>
          </div>
        ) : (
          <>
            <ul className="model-list">
              {models.models.map((model) => {
                const nameId = `${ids}-m-${model.id}`;
                const isActive = model.id === models.active;
                return (
                  <li key={model.id} className={`model${isActive ? " model--active" : ""}`}>
                    <p className="model__name" id={nameId}>
                      {model.name}
                      {isActive ? <span className="badge">Ativo</span> : null}
                    </p>
                    <p className="model__meta">
                      {formatBytes(model.size_bytes)}
                      {model.quant ? ` · ${model.quant}` : ""}
                      {model.parts > 1 ? ` · ${model.parts} partes` : ""}
                    </p>
                    <p className={`fit fit--${model.fit}`}>{FIT_LABEL[model.fit]}</p>
                    {!model.complete ? <p className="panel__error">Faltam partes deste modelo.</p> : null}
                    {isActive && (state === "starting" || state === "ready") ? (
                      <p className="model__state">{state === "starting" ? "Carregando o modelo…" : "Pronto"}</p>
                    ) : null}
                    {model.source === "extra" ? (
                      <p className="model__meta">
                        Numa pasta extra: <code className="path">{model.folder}</code>
                      </p>
                    ) : null}
                    {removing?.id === model.id ? (
                      <div className="confirm" role="group" aria-labelledby={`${nameId}-rm`}>
                        <p id={`${nameId}-rm`} className="confirm__title">
                          Apagar {model.name} do disco?
                        </p>
                        <p>
                          Isto apaga o arquivo{model.parts > 1 ? ` (todas as ${model.parts} partes)` : ""} do disco e
                          não pode ser desfeito. Para usar de novo, será preciso baixar outra vez.
                        </p>
                        <div className="actions">
                          <button
                            type="button"
                            className="button button--danger"
                            disabled={removing.sending}
                            onClick={() => void confirmRemove(model.id, model.name)}
                          >
                            Apagar do disco
                          </button>
                          <button
                            type="button"
                            className="button button--secondary"
                            disabled={removing.sending}
                            onClick={() => setRemoving(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="actions">
                        <button
                          type="button"
                          className="button button--primary"
                          aria-describedby={nameId}
                          disabled={!installed || !model.complete || downloading || pendingModel !== null}
                          onClick={() => void chooseModel(model.id)}
                        >
                          Usar este modelo
                        </button>
                        {model.removable !== false ? (
                          <button
                            type="button"
                            className="button button--secondary"
                            aria-describedby={nameId}
                            disabled={pendingModel !== null || removing !== null}
                            onClick={() => setRemoving({ id: model.id, sending: false })}
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                    )}
                    {model.removable === false ? (
                      <p className="hint">O Henduran não apaga modelos de pastas extras.</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {!installed ? <p className="hint">Baixe o motor de IA antes de usar um modelo.</p> : null}
            <div className="actions">
              <button type="button" className="button button--secondary" onClick={() => void loadModels()}>
                Atualizar lista
              </button>
            </div>
            <p className="hint">
              Pasta de modelos: <code className="path">{models.models_dir}</code>
            </p>
          </>
        )}
        <p className="hint" aria-live="polite">
          {removedNotice}
        </p>
      </section>

      <HubSearch info={info} onDownloadStarted={downloads.upsert} refreshToken={completed} />

      <DownloadsPanel
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
      />

      <ModelFolders info={info} onChange={() => void loadModels()} />
    </section>
  );
}
