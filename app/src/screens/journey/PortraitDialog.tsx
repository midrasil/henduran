import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { BackendInfo } from "../../api/backend";
import { deletePortrait, portraitErrorMessage, updatePortraitCrop, uploadPortrait } from "../../api/journeyScreen";
import type { PortraitInfo } from "../../api/journeys";
import { Button, clampCrop, cropBox, DEFAULT_CROP, Dialog, Portrait, type PortraitCropValue } from "../../ui";

export interface PortraitDialogProps {
  open: boolean;
  onClose: () => void;
  info: BackendInfo;
  name: string;
  /** Retrato atual (imagem já carregada e enquadramento), se houver. */
  currentUrl: string | null;
  currentCrop: PortraitCropValue | null;
  /** Chamado depois de salvar (`null` = removido). */
  onSaved: (portrait: PortraitInfo | null, newImage: boolean) => void;
  /**
   * Modo local (Nova Jornada): nada vai ao serviço; o arquivo escolhido (ou `null`, mantendo a
   * imagem atual) e o enquadramento voltam para quem chamou, que envia depois de criar a Jornada.
   */
  local?: {
    onApply: (file: File | null, crop: PortraitCropValue) => void;
    onRemove: () => void;
    /** Confere o arquivo antes de aceitar (mensagem de erro ou `null`). */
    check?: (file: File) => Promise<string | null>;
  };
}

const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;
const MOVE_STEP = 0.02;

const createUrl = (file: Blob): string | null =>
  typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;

/**
 * Recorte do retrato (09, item 2.7): escolher a imagem, arrastar e aproximar,
 * com prévia. Envia a imagem original com o enquadramento (PUT); sem imagem
 * nova, só refaz o enquadramento (PATCH). A validação do arquivo é do serviço.
 */
export function PortraitDialog({ open, onClose, info, name, currentUrl, currentCrop, onSaved, local }: PortraitDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<PortraitCropValue>(currentCrop ?? DEFAULT_CROP);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; crop: PortraitCropValue } | null>(null);

  // Ao abrir, começa do retrato atual.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setFileUrl(null);
    setCrop(currentCrop ?? DEFAULT_CROP);
    setNatural(null);
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // A URL local do arquivo escolhido é revogada ao trocar de arquivo ou fechar.
  useEffect(
    () => () => {
      if (fileUrl && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );

  const src = fileUrl ?? currentUrl;
  const hasImage = file !== null || currentUrl !== null;

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const box = cropBox(natural, crop);
    img.style.setProperty("width", `${box.width}%`);
    img.style.setProperty("height", `${box.height}%`);
    img.style.setProperty("left", `${box.left}%`);
    img.style.setProperty("top", `${box.top}%`);
  }, [natural, crop, src]);

  /** Atualiza a partir do valor mais recente (teclas repetidas não se perdem). */
  const update = (next: (c: PortraitCropValue) => PortraitCropValue) => setCrop((c) => clampCrop(natural, next(c)));

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    if (local?.check) {
      const problem = await local.check(picked);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setFile(picked);
    setFileUrl(createUrl(picked));
    setNatural(null);
    setCrop(DEFAULT_CROP);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!src) return;
    drag.current = { x: e.clientX, y: e.clientY, crop };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const stage = stageRef.current;
    if (!start || !stage || !natural) return;
    const rect = stage.getBoundingClientRect();
    const box = cropBox(natural, start.crop);
    // px do quadro → fração da imagem: a imagem ocupa box.width% do quadro.
    const dx = (e.clientX - start.x) / ((rect.width * box.width) / 100);
    const dy = (e.clientY - start.y) / ((rect.height * box.height) / 100);
    update(() => ({ ...start.crop, x: start.crop.x - dx, y: start.crop.y - dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // Teclado: setas movem o enquadramento; + e − aproximam.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-MOVE_STEP, 0],
      ArrowRight: [MOVE_STEP, 0],
      ArrowUp: [0, -MOVE_STEP],
      ArrowDown: [0, MOVE_STEP],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      update((c) => ({ ...c, x: c.x + move[0], y: c.y + move[1] }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      update((c) => ({ ...c, zoom: Math.min(ZOOM_MAX, c.zoom + ZOOM_STEP) }));
    } else if (e.key === "-") {
      e.preventDefault();
      update((c) => ({ ...c, zoom: Math.max(1, c.zoom - ZOOM_STEP) }));
    }
  };

  const round = (c: PortraitCropValue): PortraitCropValue => ({
    x: Math.round(c.x * 10000) / 10000,
    y: Math.round(c.y * 10000) / 10000,
    zoom: Math.round(c.zoom * 100) / 100,
  });

  const save = async () => {
    if (local) {
      local.onApply(file, round(crop));
      onClose();
      return;
    }
    setSaving("save");
    setError(null);
    try {
      const saved = file ? await uploadPortrait(info, file, round(crop)) : await updatePortraitCrop(info, round(crop));
      onSaved(saved, file !== null);
      onClose();
    } catch (err) {
      setError(portraitErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const remove = async () => {
    if (local) {
      local.onRemove();
      onClose();
      return;
    }
    setSaving("delete");
    setError(null);
    try {
      await deletePortrait(info);
      onSaved(null, false);
      onClose();
    } catch (err) {
      setError(portraitErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Retrato do personagem"
      size="wide"
      dismissible={saving === null}
      actions={
        <>
          {currentUrl && !file ? (
            <Button variant="danger" onClick={() => void remove()} loading={saving === "delete"} disabled={saving !== null}>
              Remover retrato
            </Button>
          ) : null}
          <Button onClick={onClose} disabled={saving !== null}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving === "save"} disabled={!hasImage || saving !== null}>
            {file || !currentUrl ? "Usar este retrato" : "Salvar enquadramento"}
          </Button>
        </>
      }
    >
      <div className="crop">
        <div
          ref={stageRef}
          className={`crop__stage${src ? " crop__stage--ready" : ""}`}
          role="group"
          aria-label="Enquadramento: arraste a imagem ou use as setas; + e − aproximam"
          tabIndex={src ? 0 : -1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          {src ? (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              className={`crop__img${natural ? "" : " crop__img--loading"}`}
              onLoad={(e) => {
                const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
                setNatural(n);
                setCrop((c) => clampCrop(n, c));
              }}
            />
          ) : (
            <p className="crop__empty">Escolha uma imagem do computador.</p>
          )}
          <span className="crop__guide" aria-hidden="true" />
        </div>
        <div className="crop__controls">
          <label className="crop__file">
            <span>Escolher imagem do computador</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void choose(e.target.files?.[0])} />
            <span className="hint">PNG, JPEG ou WebP, até 20 MB.</span>
          </label>
          <label className="crop__zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={ZOOM_MAX}
              step={0.01}
              value={crop.zoom}
              disabled={!src}
              onChange={(e) => {
                const zoom = Number(e.target.value);
                update((c) => ({ ...c, zoom }));
              }}
            />
          </label>
          <p className="hint">Arraste a imagem para enquadrar o rosto. A imagem original fica guardada; o recorte pode ser refeito depois.</p>
          <div className="crop__preview">
            <span className="hint">Prévia</span>
            <Portrait name={name} src={src} crop={crop} size="sm" />
          </div>
          {error ? (
            <p className="callout callout--danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
