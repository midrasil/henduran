import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { PixelIcon } from "../icons";
import { drawSky, isNightPeriod, PERIOD_LABEL, type DayPeriod } from "./sky";

import "./SkyBackdrop.css";

export interface SkyBackdropProps {
  period: DayPeriod;
  /** Tamanho de cada pixel da arte, em pixels CSS inteiros (padrão 4). */
  pixelSize?: number;
  className?: string;
}

interface Layer {
  key: number;
  period: DayPeriod;
}

interface ArtSize {
  w: number;
  h: number;
}

const FALLBACK_SIZE: ArtSize = { w: 80, h: 24 };

export function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("motion-reduced")) return true;
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/**
 * Céu decorativo do período do dia (`aria-hidden`). Desenha uma vez por período
 * e por tamanho; sem laço de animação. A troca de período faz um crossfade curto
 * em degraus, imediato com movimento reduzido. O período deve aparecer também
 * em texto (veja `PeriodLabel`).
 */
export function SkyBackdrop({ period, pixelSize = 4, className }: SkyBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ArtSize | null>(null);
  const nextKey = useRef(1);
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, period }]);

  // Mede o contêiner e recalcula o tamanho da arte (pixels inteiros).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setSize((prev) => prev ?? FALLBACK_SIZE);
        return;
      }
      const w = Math.ceil(rect.width / pixelSize);
      const h = Math.ceil(rect.height / pixelSize);
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pixelSize]);

  // Troca de período: nova camada por cima; a antiga sai ao fim do crossfade.
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top?.period === period) return prev;
      const layer = { key: nextKey.current++, period };
      return prefersReducedMotion() || !top ? [layer] : [top, layer];
    });
  }, [period]);

  const settle = (key: number) => setLayers((prev) => prev.filter((l) => l.key >= key));

  return (
    <div
      ref={rootRef}
      className={["sky", className ?? ""].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-period={period}
    >
      {size
        ? layers.map((layer, index) => (
            <SkyLayer
              key={layer.key}
              period={layer.period}
              size={size}
              pixelSize={pixelSize}
              entering={index > 0}
              onEntered={() => settle(layer.key)}
            />
          ))
        : null}
    </div>
  );
}

function SkyLayer({
  period,
  size,
  pixelSize,
  entering,
  onEntered,
}: {
  period: DayPeriod;
  size: ArtSize;
  pixelSize: number;
  entering: boolean;
  onEntered: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    // Tamanho exibido por CSSOM (permitido pela CSP), sempre múltiplo inteiro.
    canvas.style.setProperty("width", `${size.w * pixelSize}px`);
    canvas.style.setProperty("height", `${size.h * pixelSize}px`);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawSky(ctx, size.w, size.h, period);
  }, [period, size, pixelSize]);

  return (
    <canvas
      ref={canvasRef}
      className={`sky__layer${entering ? " sky__layer--enter" : ""}`}
      data-period={period}
      onAnimationEnd={entering ? onEntered : undefined}
    />
  );
}

/** Período do dia em texto, com ícone de sol ou lua. */
export function PeriodLabel({ period, prefix = "Período do dia:" }: { period: DayPeriod; prefix?: string }) {
  return (
    <span className="period-label">
      <PixelIcon name={isNightPeriod(period) ? "moon" : "sun"} className="period-label__icon" />
      <span className="visually-hidden">{prefix} </span>
      <span>{PERIOD_LABEL[period]}</span>
    </span>
  );
}
