import { useLayoutEffect, useRef, useState } from "react";

import { PixelIcon } from "../icons";

import "./Portrait.css";

export interface PortraitCropValue {
  x: number;
  y: number;
  zoom: number;
}

export interface PortraitProps {
  /** Nome do personagem (iniciais sem retrato e rótulo acessível). */
  name: string;
  /** URL local da imagem original (`blob:`); `null` sem retrato. */
  src: string | null;
  crop?: PortraitCropValue | null;
  size?: "sm" | "md" | "lg";
  /** Com `onClick`, o retrato vira botão (abre o recorte). */
  onClick?: () => void;
  /** Rótulo do botão (padrão "Trocar o retrato de <nome>"). */
  actionLabel?: string;
  className?: string;
}

export const DEFAULT_CROP: PortraitCropValue = { x: 0.5, y: 0.5, zoom: 1 };

/** Iniciais do nome (até duas letras). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Geometria da imagem dentro de um quadro quadrado, em % do quadro: com zoom 1 o
 * lado menor da imagem cobre o quadro; `x` e `y` são o centro visível (0 a 1).
 */
export function cropBox(natural: { w: number; h: number }, crop: PortraitCropValue) {
  const side = Math.min(natural.w, natural.h) || 1;
  const width = (natural.w / side) * crop.zoom * 100;
  const height = (natural.h / side) * crop.zoom * 100;
  return { width, height, left: 50 - crop.x * width, top: 50 - crop.y * height };
}

/** Mantém o centro de modo que o quadro fique todo dentro da imagem. */
export function clampCrop(natural: { w: number; h: number } | null, crop: PortraitCropValue): PortraitCropValue {
  const zoom = Math.min(8, Math.max(1, crop.zoom));
  if (!natural || !natural.w || !natural.h) {
    return { x: Math.min(1, Math.max(0, crop.x)), y: Math.min(1, Math.max(0, crop.y)), zoom };
  }
  const side = Math.min(natural.w, natural.h);
  const halfX = side / zoom / 2 / natural.w;
  const halfY = side / zoom / 2 / natural.h;
  return {
    x: Math.min(1 - halfX, Math.max(halfX, crop.x)),
    y: Math.min(1 - halfY, Math.max(halfY, crop.y)),
    zoom,
  };
}

/** Imagem posicionada pelo enquadramento (CSSOM, permitido pela CSP). */
export function CroppedImage({ src, crop, className }: { src: string; crop: PortraitCropValue; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const img = ref.current;
    if (!img || !natural) return;
    const box = cropBox(natural, crop);
    img.style.setProperty("width", `${box.width}%`);
    img.style.setProperty("height", `${box.height}%`);
    img.style.setProperty("left", `${box.left}%`);
    img.style.setProperty("top", `${box.top}%`);
  }, [natural, crop]);

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      draggable={false}
      className={["portrait__img", natural ? "" : "portrait__img--loading", className ?? ""].filter(Boolean).join(" ")}
      onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
    />
  );
}

/** Retrato em moldura circular em degraus de pixel; sem imagem, as iniciais. */
export function Portrait({ name, src, crop, size = "md", onClick, actionLabel, className }: PortraitProps) {
  const content = (
    <>
      <span className="portrait__ring" aria-hidden="true" />
      <span className="portrait__ring2" aria-hidden="true" />
      <span className="portrait__pic">
        {src ? <CroppedImage src={src} crop={crop ?? DEFAULT_CROP} /> : <b aria-hidden="true">{initials(name)}</b>}
      </span>
      {onClick ? (
        <span className="portrait__edit" aria-hidden="true">
          <PixelIcon name="camera" />
        </span>
      ) : null}
    </>
  );
  const classes = ["portrait", `portrait--${size}`, className ?? ""].filter(Boolean).join(" ");
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={actionLabel ?? `Trocar o retrato de ${name}`} data-tip="Trocar o retrato">
        {content}
      </button>
    );
  }
  return (
    <span className={classes} role="img" aria-label={src ? `Retrato de ${name}` : `${name}, sem retrato`}>
      {content}
    </span>
  );
}
