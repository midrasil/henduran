import { useEffect, useId, useRef, useState, type RefObject } from "react";

import type { BackendInfo } from "../../api/backend";
import { fetchEstimate, formatBytes, type GpuLayers, type LocalModel, type ModelOptions, type VramEstimate } from "../../api/engine";
import { Button, Dialog, Select } from "../../ui";
import { FitBadge } from "../FitBadge";
import { CONTEXT_OPTIONS, describe, displayName } from "./modelsText";

export interface LoadModelDialogProps {
  info: BackendInfo;
  /** Modelo a carregar; `null` fecha o diálogo. */
  model: LocalModel | null;
  onClose: () => void;
  onConfirm: (model: LocalModel, options: ModelOptions) => Promise<void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const GB = 2 ** 30;

function gbText(bytes: number): string {
  return `${(bytes / GB).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

/**
 * Diálogo **Carregar…**: tamanho do contexto (4.096 a 32.768 tokens), camadas na placa de
 * vídeo (automático ou controle deslizante) e a memória de vídeo estimada pelo serviço.
 */
export function LoadModelDialog({ info, model, onClose, onConfirm, returnFocusRef }: LoadModelDialogProps) {
  const ids = useId();
  const [context, setContext] = useState(4096);
  const [auto, setAuto] = useState(true);
  const [layers, setLayers] = useState(0);
  const [estimate, setEstimate] = useState<VramEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Ao abrir: os ajustes salvos do modelo (ou os padrões).
  const modelId = model?.id ?? null;
  useEffect(() => {
    if (!model) return;
    const saved = model.options;
    const ctx = saved?.context_size ?? 4096;
    setContext(CONTEXT_OPTIONS.includes(ctx as (typeof CONTEXT_OPTIONS)[number]) ? ctx : 4096);
    setAuto(saved?.gpu_layers === undefined || saved.gpu_layers === "auto");
    setLayers(typeof saved?.gpu_layers === "number" ? saved.gpu_layers : 0);
    setEstimate(null);
    setEstimateError(null);
    setError(null);
    setSending(false);
    // Só ao trocar de modelo.
  }, [modelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const gpuLayers: GpuLayers = auto ? "auto" : layers;
  const layerKey = String(gpuLayers);

  // Estimativa a cada ajuste (a resposta mais recente vence).
  useEffect(() => {
    if (!modelId) return;
    const mine = ++request.current;
    fetchEstimate(info, modelId, context, gpuLayers)
      .then((out) => {
        if (mine !== request.current) return;
        setEstimate(out);
        setEstimateError(null);
        // Ao sair do automático, o controle começa no que o automático estimou.
        if (auto && out.layers_on_gpu !== null) setLayers(out.layers_on_gpu);
      })
      .catch((err: unknown) => {
        if (mine === request.current) setEstimateError(describe(err));
      });
  }, [info, modelId, context, layerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return <Dialog open={false} title="" onClose={onClose} />;

  const total = estimate?.total_layers ?? null;
  const cpuOnly = estimate?.variant === "cpu";
  const over = estimate?.vram_bytes != null && estimate.vram_total_bytes > 0 && estimate.vram_bytes > estimate.vram_total_bytes;

  const confirm = async () => {
    setSending(true);
    setError(null);
    try {
      await onConfirm(model, { context_size: context, gpu_layers: gpuLayers });
    } catch (err) {
      setError(describe(err));
      setSending(false);
    }
  };

  return (
    <Dialog
      open
      title={`Carregar ${displayName(model.name)}`}
      onClose={() => {
        if (!sending) onClose();
      }}
      dismissible={!sending}
      initialFocusRef={cancelRef}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      description={
        <p>
          {model.quant ? `${model.quant} · ` : ""}
          {formatBytes(model.size_bytes)}. Ajuste o contexto e as camadas na placa de vídeo, ou deixe no automático.
        </p>
      }
      actions={
        <>
          <Button ref={cancelRef} disabled={sending} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={sending} onClick={() => void confirm()}>
            Carregar
          </Button>
        </>
      }
    >
      <div className="mdl-load">
        <p>
          <FitBadge fit={model.fit} />
        </p>
        <Select
          label="Tamanho do contexto"
          hint="Mais contexto lembra mais da conversa, mas usa mais memória."
          value={String(context)}
          disabled={sending}
          options={CONTEXT_OPTIONS.map((c) => ({ value: String(c), label: `${c.toLocaleString("pt-BR")} tokens` }))}
          onChange={(event) => setContext(Number(event.target.value))}
        />

        {cpuOnly ? (
          <p className="hint">O motor instalado é a variante CPU: nenhuma camada vai para a placa de vídeo.</p>
        ) : (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={auto}
                disabled={sending || total === null}
                onChange={(event) => setAuto(event.target.checked)}
              />
              Camadas na placa de vídeo: automático
              {auto && estimate?.layers_on_gpu != null && total !== null ? ` (${estimate.layers_on_gpu} de ${total})` : ""}
            </label>
            {total === null && estimate ? (
              <p className="hint">Não foi possível ler o número de camadas deste modelo; fica no automático.</p>
            ) : null}
            {!auto && total !== null ? (
              <div className="field">
                <label htmlFor={`${ids}-layers`} className="field__label">
                  Camadas na placa de vídeo: {layers} de {total}
                </label>
                <input
                  id={`${ids}-layers`}
                  type="range"
                  className="mdl-range"
                  min={0}
                  max={total}
                  step={1}
                  value={Math.min(layers, total)}
                  disabled={sending}
                  aria-valuetext={`${layers} de ${total} camadas`}
                  onChange={(event) => setLayers(Number(event.target.value))}
                />
              </div>
            ) : null}
          </>
        )}

        <p className="mdl-load__estimate" aria-live="polite">
          {estimateError ? (
            <span className="text-danger">Não foi possível estimar a memória de vídeo: {estimateError}</span>
          ) : !estimate ? (
            "Estimando a memória de vídeo…"
          ) : estimate.vram_bytes === null ? (
            "Não foi possível estimar a memória de vídeo deste modelo."
          ) : (
            <>
              Memória de vídeo estimada: <strong>{gbText(estimate.vram_bytes)}</strong>
              {estimate.vram_total_bytes > 0 ? ` de ${gbText(estimate.vram_total_bytes)}` : ""}.
            </>
          )}
        </p>
        {over ? (
          <p className="callout callout--warn">
            A estimativa passa da memória da placa: o motor pode falhar ao carregar. Reduza o contexto ou as camadas.
          </p>
        ) : null}
        <p className="hint">
          Estimativa aproximada: os pesos do modelo nas camadas da placa e a memória do contexto (o motor reserva o
          contexto para {estimate?.slots ?? 2} conversas ao mesmo tempo).
        </p>
        {error ? (
          <p className="callout callout--danger" role="alert">
            Erro: {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
