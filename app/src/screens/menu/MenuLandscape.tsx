import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { prefersReducedMotion, type DayPeriod } from "../../ui";
import { castleWidth, drawLandscapeBase, drawLandscapeLayers, hasMotion, LANDSCAPE_FPS } from "./landscape";

/** Largura a partir da qual o cartão fica à direita da coluna (a mesma de MainMenu.css). */
const WIDE_MIN = 1180;
/** Distância entre a coluna e o cartão (`left: calc(100% + 56px)` em MainMenu.css). */
const CARD_GAP = 56;

const cssPx = (el: Element, name: string, fallback: number) => {
  const value = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Onde ficam os castelos. Em telas largas, vão para fora do cartão (à direita da coluna
 * central), sem sair da tela; se não couberem com folga, encostam na borda e viram a torre
 * para fora (para ela não ficar atrás do cartão). Nas estreitas, a 14% da borda.
 */
export function castlePlacement(widthCss: number, pixelSize: number, column: number, card: number): { x: number; towersOut: boolean } {
  const fallback = { x: 0.14, towersOut: false };
  if (widthCss < WIDE_MIN) return fallback;
  const half = (castleWidth(Math.ceil(widthCss / pixelSize)) * pixelSize) / 2;
  const clear = widthCss / 2 + column / 2 + CARD_GAP + card + half + 32;
  const edge = widthCss - half - 8;
  const right = Math.min(clear, edge);
  return { x: Math.min(fallback.x, 1 - right / widthCss), towersOut: clear > edge };
}

interface ArtSize {
  w: number;
  h: number;
  /** Centro do castelo da esquerda (fração da largura) e torres para fora. */
  castleX: number;
  towersOut: boolean;
}

/** Acompanha `prefers-reduced-motion` (e o alternador da galeria) enquanto o menu está aberto. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(prefersReducedMotion());
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export interface MenuLandscapeProps {
  period: DayPeriod;
  /** Tamanho de cada pixel da arte, em pixels CSS inteiros (padrão 4, como o céu). */
  pixelSize?: number;
  className?: string;
}

/**
 * Paisagem viva do menu, em tela cheia e decorativa (`aria-hidden`; o período aparece em
 * texto no cartão da última Jornada). Anima a cerca de 10 quadros por segundo, só com a
 * janela visível; parada com movimento reduzido (ADR-068).
 */
export function MenuLandscape({ period, pixelSize = 4, className }: MenuLandscapeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<ArtSize | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const w = Math.ceil(rect.width / pixelSize);
      const h = Math.ceil(rect.height / pixelSize);
      const menu = root.parentElement ?? root;
      const { x: castleX, towersOut } = castlePlacement(rect.width, pixelSize, cssPx(menu, "--menu-column", 320), cssPx(menu, "--menu-card", 340));
      setSize((prev) =>
        prev && prev.w === w && prev.h === h && prev.castleX === castleX && prev.towersOut === towersOut ? prev : { w, h, castleX, towersOut },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [pixelSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    canvas.width = size.w;
    canvas.height = size.h;
    // Tamanho exibido por CSSOM (permitido pela CSP), sempre múltiplo inteiro.
    canvas.style.setProperty("width", `${size.w * pixelSize}px`);
    canvas.style.setProperty("height", `${size.h * pixelSize}px`);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const base = document.createElement("canvas");
    base.width = size.w;
    base.height = size.h;
    const baseCtx = base.getContext("2d");
    if (!baseCtx) return;
    const layers = drawLandscapeBase(baseCtx, size.w, size.h, period, { castleX: size.castleX, towersOut: size.towersOut });
    let tick = 0;
    const frame = () => {
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.drawImage(base, 0, 0);
      drawLandscapeLayers(ctx, layers, tick, reduced);
      tick++;
    };
    frame();
    if (reduced || !hasMotion(layers)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") frame();
    }, 1000 / LANDSCAPE_FPS);
    return () => window.clearInterval(timer);
  }, [period, size, pixelSize, reduced]);

  return (
    <div ref={rootRef} className={["menu-scene", className ?? ""].filter(Boolean).join(" ")} aria-hidden="true" data-period={period} data-motion={reduced ? "off" : "on"}>
      <canvas ref={canvasRef} className="menu-scene__canvas" />
      <div className="menu-scene__vignette" />
    </div>
  );
}
