import { useEffect, useId, useRef, useState } from "react";

import type { BackendInfo } from "../../api/backend";
import {
  fetchEngineRelease,
  formatBytes,
  installEngine,
  type EngineRelease,
  type EngineStatus,
  type EngineVariant,
  type HardwareInfo,
  type LocalModel,
} from "../../api/engine";
import { Button, Dialog, ProgressBar } from "../../ui";
import { describe, displayName } from "./modelsText";

export interface StatusHeaderProps {
  info: BackendInfo;
  engine: EngineStatus | null;
  engineError: string | null;
  hardware: HardwareInfo | null;
  hardwareError: string | null;
  /** Modelo carregado ou selecionado (o `active` da lista), se houver. */
  selected: LocalModel | null;
  onEngineChange: (status: EngineStatus) => void;
  onLoad: (model: LocalModel) => void;
  onUnload: () => void;
  onRetry: () => void;
  busy: boolean;
  /** Muda para abrir o diálogo de download do motor (por exemplo, da tela inicial sem modelo). */
  openDownloadToken?: number;
}

type DownloadStep =
  | { kind: "choose"; variant: EngineVariant; error: string | null }
  | { kind: "checking"; variant: EngineVariant }
  | { kind: "confirm"; release: EngineRelease; acknowledged: boolean; error: string | null }
  | { kind: "sending"; release: EngineRelease };

const GB = 2 ** 30;

function gbText(bytes: number): string {
  return `${(bytes / GB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
}

function Led({ tone }: { tone: "ok" | "busy" | "bad" | "off" }) {
  return <span className={`mdl-led mdl-led--${tone}`} aria-hidden="true" />;
}

/** Cabeçalho da tela Modelos: três quadros com o estado do PC, do motor e do Narrador (sem título). */
export function StatusHeader({
  info,
  engine,
  engineError,
  hardware,
  hardwareError,
  selected,
  onEngineChange,
  onLoad,
  onUnload,
  onRetry,
  busy,
  openDownloadToken = 0,
}: StatusHeaderProps) {
  const ids = useId();
  const [download, setDownload] = useState<DownloadStep | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const downloadButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (openDownloadToken > 0) setDownload({ kind: "choose", variant: "vulkan", error: null });
  }, [openDownloadToken]);

  const state = engine?.state ?? "stopped";
  const installed = engine?.installed ?? false;

  const checkRelease = async (variant: EngineVariant) => {
    setDownload({ kind: "checking", variant });
    try {
      const release = await fetchEngineRelease(info, variant);
      setDownload({ kind: "confirm", release, acknowledged: false, error: null });
    } catch (error) {
      setDownload({ kind: "choose", variant, error: describe(error) });
    }
  };

  const confirmDownload = async (release: EngineRelease) => {
    setDownload({ kind: "sending", release });
    try {
      onEngineChange(await installEngine(info, release.variant, !release.verifiable));
      setDownload(null);
    } catch (error) {
      setDownload({ kind: "confirm", release, acknowledged: false, error: describe(error) });
    }
  };

  /* ---------------------------------------------------------------- Este PC */
  const biggest = hardware?.gpus.slice().sort((a, b) => b.memory_bytes - a.memory_bytes) ?? [];
  const pc = hardwareError ? (
    <p className="text-danger">Não foi possível ler o hardware: {hardwareError}</p>
  ) : !hardware ? (
    <p className="mdl-box__small">Lendo o hardware…</p>
  ) : (
    <>
      {biggest.length === 0 ? (
        <p className="mdl-box__main">Nenhuma placa de vídeo encontrada</p>
      ) : (
        biggest.map((gpu, index) => (
          <p key={`${gpu.name}-${index}`} className={index === 0 ? "mdl-box__main" : "mdl-box__small"}>
            {gpu.name}
          </p>
        ))
      )}
      <p className="mdl-box__small">
        {biggest[0] && biggest[0].memory_bytes > 0
          ? `${gbText(biggest[0].memory_bytes)} de memória de vídeo`
          : biggest[0]
            ? "Memória de vídeo desconhecida"
            : "Sem memória de vídeo"}
        {" · "}
        {hardware.ram_bytes > 0 ? `${gbText(hardware.ram_bytes)} de RAM` : "RAM desconhecida"}
      </p>
      <p className="mdl-box__small">
        {hardware.cpu || "Processador desconhecido"}
        {hardware.os ? ` · ${hardware.os}` : ""}
      </p>
    </>
  );

  /* ---------------------------------------------------------------- Motor */
  let engineBody;
  if (!engine) {
    engineBody = (
      <p className="mdl-box__line" role="status">
        <Led tone={engineError ? "bad" : "off"} />
        {engineError ? `Não foi possível consultar o motor: ${engineError}` : "Consultando o motor…"}
      </p>
    );
  } else if (state === "downloading") {
    const percent = Math.round((engine.progress ?? 0) * 100);
    engineBody = (
      <>
        <p className="mdl-box__line" role="status">
          <Led tone="busy" />
          Baixando o motor… {percent}%
        </p>
        <ProgressBar label="Progresso do download do motor" value={engine.progress ?? 0} />
      </>
    );
  } else if (!installed) {
    engineBody = (
      <>
        <p className="mdl-box__line" role="status">
          <Led tone={state === "error" ? "bad" : "off"} />
          {state === "error" ? "O download do motor falhou" : "Motor não instalado"}
        </p>
        <p className="mdl-box__small">
          {state === "error" && engine.message
            ? engine.message
            : "Baixe o motor de IA (llama.cpp), conferido pelo SHA-256 quando publicado."}
        </p>
        <div className="mdl-box__actions">
          <Button
            ref={downloadButton}
            size="sm"
            variant="primary"
            onClick={() => setDownload({ kind: "choose", variant: "vulkan", error: null })}
          >
            {state === "error" ? "Tentar de novo" : "Baixar o motor"}
          </Button>
        </div>
      </>
    );
  } else if (state === "error") {
    engineBody = (
      <>
        <p className="mdl-box__line" role="status">
          <Led tone="bad" />O motor teve um erro
        </p>
        {engine.message ? <p className="mdl-box__small">{engine.message}</p> : null}
        <div className="mdl-box__actions">
          <Button size="sm" onClick={() => setLogOpen(true)}>
            Ver o log
          </Button>
          <Button size="sm" variant="primary" disabled={busy || !engine.active_model} onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      </>
    );
  } else {
    const label = state === "ready" ? "Motor pronto" : state === "starting" ? "Carregando o modelo…" : "Motor parado";
    engineBody = (
      <>
        <p className="mdl-box__line" role="status">
          <Led tone={state === "ready" ? "ok" : state === "starting" ? "busy" : "off"} />
          {label}
        </p>
        <p className="mdl-box__small">
          {engine.variant === "cpu" ? "CPU (só o processador)" : "Vulkan (usa a placa de vídeo)"}
          {engine.version ? ` · versão ${engine.version}` : ""}
          {engine.verified === false ? " · instalado sem verificação de integridade" : ""}
        </p>
        <div className="mdl-box__actions">
          {state === "ready" || state === "starting" ? (
            <Button size="sm" disabled={busy} onClick={onUnload}>
              Parar o motor
            </Button>
          ) : null}
          {engine.log ? (
            <Button size="sm" variant="ghost" onClick={() => setLogOpen(true)}>
              Ver o log
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  /* -------------------------------------------------------------- Narrador */
  const isLoaded = !!selected && state === "ready" && engine?.active_model === selected.id;
  const isLoading = !!selected && state === "starting" && engine?.active_model === selected.id;
  const narrator = !selected ? (
    <>
      <p className="mdl-box__main">Nenhum modelo</p>
      <p className="mdl-box__small">Escolha ou baixe um modelo para o Narrador responder.</p>
    </>
  ) : (
    <>
      <p className="mdl-box__main">{displayName(selected.name)}</p>
      <p className="mdl-box__small">
        {selected.quant ? `${selected.quant} · ` : ""}
        {formatBytes(selected.size_bytes)} ·{" "}
        {isLoaded ? "carregado" : isLoading ? "carregando…" : "selecionado, ainda não carregado"}
      </p>
      <div className="mdl-box__actions">
        {isLoaded || isLoading ? (
          <Button size="sm" disabled={busy} onClick={onUnload}>
            Descarregar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            disabled={busy || !installed || state === "downloading" || !selected.complete}
            onClick={() => onLoad(selected)}
          >
            Carregar
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="mdl-status">
      <section className="mdl-box" aria-labelledby={`${ids}-pc`}>
        <h3 id={`${ids}-pc`} className="mdl-box__title">
          Este PC
        </h3>
        {pc}
      </section>
      <section className="mdl-box" aria-labelledby={`${ids}-engine`}>
        <h3 id={`${ids}-engine`} className="mdl-box__title">
          Motor de IA
        </h3>
        {engineBody}
      </section>
      <section className="mdl-box" aria-labelledby={`${ids}-narrator`}>
        <h3 id={`${ids}-narrator`} className="mdl-box__title">
          Narrador
        </h3>
        {narrator}
      </section>

      <Dialog
        open={download !== null}
        title="Baixar o motor de IA"
        onClose={() => {
          if (download?.kind !== "sending") setDownload(null);
        }}
        dismissible={download?.kind !== "sending"}
        returnFocusRef={downloadButton}
        actions={
          download?.kind === "choose" || download?.kind === "checking" ? (
            <>
              <Button disabled={download.kind === "checking"} onClick={() => setDownload(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={download.kind === "checking"}
                onClick={() => void checkRelease(download.variant)}
              >
                {download.kind === "checking" ? "Consultando o tamanho…" : "Continuar"}
              </Button>
            </>
          ) : download?.kind === "confirm" || download?.kind === "sending" ? (
            <>
              <Button disabled={download.kind === "sending"} onClick={() => setDownload(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={download.kind === "sending"}
                disabled={download.kind === "confirm" && !download.release.verifiable && !download.acknowledged}
                onClick={() => void confirmDownload(download.release)}
              >
                Confirmar download
              </Button>
            </>
          ) : null
        }
      >
        {download?.kind === "choose" || download?.kind === "checking" ? (
          <>
            <fieldset className="variants">
              <legend>Variante do motor</legend>
              <label className="check">
                <input
                  type="radio"
                  name={`${ids}-variant`}
                  value="vulkan"
                  checked={download.variant === "vulkan"}
                  disabled={download.kind === "checking"}
                  onChange={() => setDownload({ kind: "choose", variant: "vulkan", error: null })}
                />
                Vulkan (padrão; usa a placa de vídeo AMD, NVIDIA ou Intel)
              </label>
              <label className="check">
                <input
                  type="radio"
                  name={`${ids}-variant`}
                  value="cpu"
                  checked={download.variant === "cpu"}
                  disabled={download.kind === "checking"}
                  onChange={() => setDownload({ kind: "choose", variant: "cpu", error: null })}
                />
                CPU (só o processador; mais lento)
              </label>
            </fieldset>
            {download.kind === "choose" && download.error ? (
              <p className="callout callout--danger" role="alert">
                Erro: {download.error}
              </p>
            ) : null}
          </>
        ) : download?.kind === "confirm" || download?.kind === "sending" ? (
          <>
            <p>
              Baixar {download.release.name} ({formatBytes(download.release.size)}), versão {download.release.tag}, dos
              releases oficiais do llama.cpp no GitHub?
            </p>
            {download.release.verifiable ? (
              <p>A integridade do arquivo será conferida pelo SHA-256 publicado.</p>
            ) : (
              <>
                <p className="callout callout--warn" role="alert">
                  Atenção: o GitHub não publicou o SHA-256 deste arquivo, então não é possível verificar se ele chegou
                  íntegro. Só continue se aceitar esse risco.
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
            )}
            {download.kind === "confirm" && download.error ? (
              <p className="callout callout--danger" role="alert">
                Erro: {download.error}
              </p>
            ) : null}
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={logOpen}
        size="wide"
        title="Log do motor de IA"
        onClose={() => setLogOpen(false)}
        actions={<Button onClick={() => setLogOpen(false)}>Fechar</Button>}
      >
        {engine?.message ? <p>{engine.message}</p> : null}
        <pre className="log" tabIndex={0} aria-label="Final do log do motor">
          {engine?.log || "O log está vazio."}
        </pre>
      </Dialog>
    </div>
  );
}
