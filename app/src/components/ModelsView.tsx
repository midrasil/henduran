import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { BackendInfo } from "../api/backend";
import { cancelDownload, forgetDownload, retryDownload } from "../api/hub";
import {
  fetchEngineRelease,
  fetchHardware,
  fetchModels,
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
import { Badge, Button, Dialog, ListCard, Panel, PixelIcon, ProgressBar } from "../ui";
import { DownloadsPanel } from "./DownloadsPanel";
import { FitBadge } from "./FitBadge";
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
  const modelsHeading = useRef<HTMLHeadingElement>(null);
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
      // Atualiza a lista antes de fechar o diálogo: se o botão Remover sumiu, o foco vai para o título da lista.
      await loadModels();
      setRemoving(null);
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

  const removingModel = removing ? models?.models.find((m) => m.id === removing.id) ?? null : null;

  return (
    <section className="models" aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className="screen-title">
        Modelos
      </h2>

      {/* Hardware */}
      <Panel variant="parchment" title="Hardware deste PC">
        {hardwareError ? (
          <p className="text-danger">Não foi possível ler o hardware: {hardwareError}</p>
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
      </Panel>

      {/* Motor */}
      <Panel title="Motor de IA">
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
        {downloading ? <ProgressBar label="Progresso do download do motor" value={engine?.progress ?? 0} /> : null}

        {!installed && !downloading ? (
          download.kind === "confirm" || download.kind === "sending" ? (
            <div className="confirm surface-parchment px-frame" role="group" aria-labelledby={`${ids}-confirm`}>
              <p id={`${ids}-confirm`} className="confirm__title">
                Baixar {download.release.name} ({formatBytes(download.release.size)}), versão{" "}
                {download.release.tag}, dos releases oficiais do llama.cpp no GitHub?
              </p>
              {!download.release.verifiable ? (
                <>
                  <p className="callout callout--warn" role="alert">
                    Atenção: o GitHub não publicou o SHA-256 deste arquivo, então não é possível verificar se ele
                    chegou íntegro. Só continue se aceitar esse risco.
                  </p>
                  {download.kind === "confirm" ? (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={download.acknowledged}
                        onChange={(event) => setDownload({ ...download, acknowledged: event.target.checked })}
                      />
                      Entendo o risco e quero baixar sem verificação
                    </label>
                  ) : null}
                </>
              ) : (
                <p>A integridade do arquivo será conferida pelo SHA-256 publicado.</p>
              )}
              <div className="actions">
                <Button
                  variant="primary"
                  loading={download.kind === "sending"}
                  disabled={download.kind === "confirm" && !download.release.verifiable && !download.acknowledged}
                  onClick={() => void confirmDownload(download.release)}
                >
                  Confirmar download
                </Button>
                <Button disabled={download.kind === "sending"} onClick={() => setDownload({ kind: "idle" })}>
                  Cancelar
                </Button>
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
              <div className="actions">
                <Button variant="primary" loading={download.kind === "checking"} onClick={() => void askDownload()}>
                  {download.kind === "checking" ? "Consultando o tamanho…" : "Baixar o motor de IA"}
                </Button>
              </div>
            </div>
          )
        ) : null}

        {installed && (state === "ready" || state === "starting") ? (
          <div className="actions">
            <Button onClick={() => void stop()}>Parar o motor</Button>
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
          <p className="callout callout--danger" role="alert">
            Erro: {actionError}
          </p>
        ) : null}
      </Panel>

      {/* Modelos locais */}
      <Panel title="Modelos locais" titleRef={modelsHeading}>
        {modelsError ? (
          <p className="text-danger">Não foi possível listar os modelos: {modelsError}</p>
        ) : !models ? (
          <p>Procurando modelos…</p>
        ) : models.models.length === 0 ? (
          <div className="empty surface-parchment px-frame">
            <p>
              Nenhum modelo .gguf encontrado. Busque e baixe um modelo abaixo, adicione uma pasta onde você já tem
              modelos ou coloque um arquivo .gguf nesta pasta e atualize a lista:
            </p>
            <p>
              <code className="path">{models.models_dir}</code>
            </p>
            <div className="actions">
              <Button onClick={() => void copyPath(models.models_dir)}>Copiar caminho</Button>
              <Button onClick={() => void loadModels()}>Atualizar lista</Button>
            </div>
            <p className="hint" aria-live="polite">
              {copied ?? ""}
            </p>
          </div>
        ) : (
          <>
            <ul className="card-list">
              {models.models.map((model) => {
                const nameId = `${ids}-m-${model.id}`;
                const isActive = model.id === models.active;
                return (
                  <ListCard
                    key={model.id}
                    title={model.name}
                    titleId={nameId}
                    selected={isActive}
                    tags={
                      <>
                        {isActive ? (
                          <Badge tone="accent" icon={<PixelIcon name="star" />}>
                            Ativo
                          </Badge>
                        ) : null}
                        <FitBadge fit={model.fit} />
                      </>
                    }
                    meta={
                      <>
                        {formatBytes(model.size_bytes)}
                        {model.quant ? ` · ${model.quant}` : ""}
                        {model.parts > 1 ? ` · ${model.parts} partes` : ""}
                      </>
                    }
                    actions={
                      <>
                        <Button
                          variant="primary"
                          aria-describedby={nameId}
                          loading={pendingModel === model.id}
                          disabled={!installed || !model.complete || downloading || pendingModel !== null}
                          onClick={() => void chooseModel(model.id)}
                        >
                          Usar este modelo
                        </Button>
                        {model.removable !== false ? (
                          <Button
                            variant="danger"
                            aria-describedby={nameId}
                            disabled={pendingModel !== null || removing !== null}
                            onClick={() => setRemoving({ id: model.id, sending: false })}
                          >
                            Remover
                          </Button>
                        ) : null}
                      </>
                    }
                  >
                    {!model.complete ? <p className="text-danger">Faltam partes deste modelo.</p> : null}
                    {isActive && (state === "starting" || state === "ready") ? (
                      <p className="list-card__meta">{state === "starting" ? "Carregando o modelo…" : "Pronto"}</p>
                    ) : null}
                    {model.source === "extra" ? (
                      <p className="list-card__meta">
                        Numa pasta extra: <code className="path">{model.folder}</code>
                      </p>
                    ) : null}
                    {model.removable === false ? (
                      <p className="hint">O Henduran não apaga modelos de pastas extras.</p>
                    ) : null}
                  </ListCard>
                );
              })}
            </ul>
            {!installed ? <p className="hint">Baixe o motor de IA antes de usar um modelo.</p> : null}
            <div className="actions">
              <Button onClick={() => void loadModels()}>Atualizar lista</Button>
            </div>
            <p className="hint">
              Pasta de modelos: <code className="path">{models.models_dir}</code>
            </p>
          </>
        )}
        <p className="hint" aria-live="polite">
          {removedNotice}
        </p>
      </Panel>

      <Dialog
        open={removing !== null && removingModel !== null}
        tone="danger"
        title={`Apagar ${removingModel?.name ?? ""} do disco?`}
        description={
          <p>
            Isto apaga o arquivo
            {removingModel && removingModel.parts > 1 ? ` (todas as ${removingModel.parts} partes)` : ""} do disco e não
            pode ser desfeito. Para usar de novo, será preciso baixar outra vez.
          </p>
        }
        onClose={() => {
          if (!removing?.sending) setRemoving(null);
        }}
        dismissible={!removing?.sending}
        initialFocusRef={cancelRemoveRef}
        returnFocusRef={modelsHeading}
        actions={
          <>
            <Button ref={cancelRemoveRef} disabled={removing?.sending} onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={removing?.sending ?? false}
              onClick={() => removingModel && void confirmRemove(removingModel.id, removingModel.name)}
            >
              Apagar do disco
            </Button>
          </>
        }
      />

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
