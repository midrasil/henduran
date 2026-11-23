/**
 * Pixel art colorida a partir de grades de texto: cada caractere é uma cor da
 * paleta (`.` é transparente). Sem arquivos de imagem; decorativa por padrão
 * (`aria-hidden`), o significado fica no texto em volta ou num `role="img"`.
 * Os desenhos vêm do protótipo aprovado (`docs/ui-ux/prototipos/tela-da-jornada.html`).
 */
import { PERIOD_LABEL, type DayPeriod } from "../SkyBackdrop/sky";

export type PixelGrid = readonly string[];
export type PixelPalette = Readonly<Record<string, string>>;

export interface PixelArtProps {
  grid: PixelGrid;
  palette: PixelPalette;
  /** Largura em pixels CSS; a altura segue a proporção da grade. */
  width: number;
  className?: string;
}

/** Junta pixels vizinhos da mesma cor numa linha em um só retângulo. */
export function pixelRuns(grid: PixelGrid, palette: PixelPalette): { x: number; y: number; w: number; fill: string }[] {
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x]!;
      const fill = c === "." ? undefined : palette[c];
      if (!fill) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      runs.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return runs;
}

export function PixelArt({ grid, palette, width, className }: PixelArtProps) {
  const w = grid[0]?.length ?? 1;
  const h = grid.length;
  return (
    <svg
      className={["pixel-art", className ?? ""].filter(Boolean).join(" ")}
      width={width}
      height={Math.round((width * h) / w)}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
      {pixelRuns(grid, palette).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/* --------------------------------------------------- ícones dos períodos (10x10) */

export const PERIOD_ART: Record<DayPeriod, { grid: PixelGrid; palette: PixelPalette }> = {
  madrugada: {
    grid: ["..........", "......s...", "..MM......", ".MMs......", ".MM.....s.", ".MM.......", ".MMm......", "..MMMm....", "s..MMM....", ".........."],
    palette: { M: "#b9bfdc", m: "#8f93c0", s: "#8f93c0" },
  },
  amanhecer: {
    grid: ["..........", "....p.....", "..........", "...SSSS...", "..SYYYYS..", ".SYYYYYYS.", "HHHHHHHHHH", ".pppppppp.", "..........", ".........."],
    palette: { S: "#ffc768", Y: "#fff0b8", H: "#a8486f", p: "#de6f6c" },
  },
  manha: {
    grid: ["....r.....", ".r......r.", "...SSSS...", "..SYYYYS..", "r.SYYYYS.r", "..SYYYYS..", "...SSSS...", ".r......r.", "....r.....", ".........."],
    palette: { S: "#fff09a", Y: "#ffffff", r: "#d8ecff" },
  },
  tarde: {
    grid: ["..........", "...SSSS...", "..SYYYYS..", ".SYYYYYYS.", ".SYYYYYYS.", "..SYYYYS..", "...SSSS...", "cc......cc", "cccc..cccc", ".........."],
    palette: { S: "#ffd878", Y: "#fff4c4", c: "#f0e6d0" },
  },
  entardecer: {
    grid: ["....s.....", "..........", "..SSSSSS..", ".SOOOOOOS.", "SOYYYYYYOS", "HHHHHHHHHH", ".hhhhhhhh.", "..hhhhhh..", "..........", ".........."],
    palette: { S: "#ec8a5c", O: "#ffb858", Y: "#ffe7a0", H: "#93407a", h: "#62307a", s: "#d8c4e8" },
  },
  noite: {
    grid: ["..s.......", ".......s..", "....MMM...", "...MMWM...", "...MM.....", "...MM.....", "...MMWM..s", "....MMM...", "s.........", "......s..."],
    palette: { M: "#e4dfc0", W: "#fbf7e2", s: "#f2ecd4" },
  },
};

/** Ícone do período do dia em pixel art. Decorativo, a não ser que `label` seja `true`. */
export function PeriodIcon({ period, size = 20, label = false, className }: { period: DayPeriod; size?: number; label?: boolean; className?: string }) {
  const art = PERIOD_ART[period];
  const icon = <PixelArt grid={art.grid} palette={art.palette} width={size} className={["period-icon", className ?? ""].filter(Boolean).join(" ")} />;
  if (!label) return icon;
  return (
    <span role="img" aria-label={PERIOD_LABEL[period]} className="period-icon__wrap">
      {icon}
    </span>
  );
}

/* ------------------------------------------- trilhas: coração (Vida) e chama (Vontade) */

export type TrackCellState = "livre" | "superficial" | "agravado";

const HEART: Record<TrackCellState, PixelGrid> = {
  livre: ["..XXX...XXX..", ".XWWHX.XHHHX.", "XWWHHHXHHHHDX", "XWHHHHHHHHHDX", "XHHHHHHHHHHDX", "XHHHHHHHHHDDX", ".XHHHHHHHHDX.", "..XHHHHHHDX..", "...XHHHHDX...", "....XHHDX....", ".....XDX.....", "......X......"],
  superficial: ["..XXX...XXX..", ".XPPPX.XPPPX.", "XPPPPPXKPPPDX", "XPPPPPKPPPPDX", "XPPPPPPKPPPDX", "XPPPPPKPPPDDX", ".XPPPPPKPPDX.", "..XPPPKPPDX..", "...XPPPKDX...", "....XPKDX....", ".....XDX.....", "......X......"],
  agravado: ["..XXX...XXX..", ".XEEEX.XEEEX.", "XEEEEEXR.EEFX", "XEEEEER.REEFX", "XEEEEEER.EEFX", "XEEEEER.REFFX", ".XEEEEER.EFX.", "..XEER.REFX..", "...XEER.FX...", "....XER.X....", ".....XRX.....", "......X......"],
};

const FLAME: Record<TrackCellState, PixelGrid> = {
  livre: [".....X.....", "....XHX....", "....XHX.X..", "...XHHHXHX.", "...XHWHHHX.", "..XHHWHHHX.", ".XHHWWHHHDX", ".XHWWCWHHDX", "XHHWCCCWHDX", "XHWCCCCCWDX", "XHWCCCCCWDX", ".XHWCCCWHX.", "..XHHHHHX..", "...XXXXX..."],
  superficial: ["...........", "...........", ".....X.....", "....XPX....", "....XPX....", "...XPPPX...", "..XPPQPPX..", "..XPQQQPX..", ".XPPQQQPDX.", ".XPQQQQQDX.", ".XPQQQQQDX.", "..XPQQQPX..", "..XPPPPPX..", "...XXXXX..."],
  agravado: ["....S......", ".....S.....", "....S......", "...S.......", "....S......", ".....S.....", "....S......", "...........", "...........", "...XXXXX...", "..XEERREX..", ".XEEEEREEX.", ".XEEEEEEFX.", "..XXXXXXX.."],
};

const HEART_PALETTE: Record<TrackCellState, PixelPalette> = {
  livre: { X: "#0e0911", H: "#e0342a", W: "#ffb3a0", D: "#8e1810" },
  superficial: { X: "#0e0911", P: "#b8706a", D: "#6e3a36", K: "#24090c" },
  agravado: { X: "#0e0911", E: "#3b1418", F: "#24090c", R: "#ff6a50" },
};

const FLAME_PALETTE: Record<TrackCellState, PixelPalette> = {
  livre: { X: "#0e0911", H: "#3c8cf0", W: "#bfe3ff", C: "#f2fbff", D: "#1a4a9a" },
  superficial: { X: "#0e0911", P: "#6f8fb8", Q: "#a9c0dc", D: "#3e5578" },
  agravado: { X: "#0e0911", E: "#1e2638", F: "#141a28", R: "#5fa8ff", S: "#7d8aa3" },
};

export type TrackIconKind = "heart" | "flame";

/** Um espaço da trilha: coração (Vida) ou chama (Vontade) no estado dado. */
export function TrackCellIcon({ kind, state, width }: { kind: TrackIconKind; state: TrackCellState; width?: number }) {
  return kind === "heart" ? (
    <PixelArt grid={HEART[state]} palette={HEART_PALETTE[state]} width={width ?? 26} className={`track-cell track-cell--${state}`} />
  ) : (
    <PixelArt grid={FLAME[state]} palette={FLAME_PALETTE[state]} width={width ?? 22} className={`track-cell track-cell--${state}`} />
  );
}

/* ------------------------------------------------------- Fraturas das Convicções */

const CRACK_ON: PixelGrid = [".XXXXXX.", "XHHKHHHX", "XHHKKHHX", "XHHHKHHX", "XHHKKHHX", "XHKHHHHX", "XHKHHHHX", ".XXXXXX."];
const CRACK_OFF: PixelGrid = [".XXXXXX.", "XHHHHHHX", "XHHHHHHX", "XHHHHHHX", "XHHHHHHX", "XHHHHHHX", "XHHHHHHX", ".XXXXXX."];

export function CrackIcon({ on, width = 18 }: { on: boolean; width?: number }) {
  return on ? (
    <PixelArt grid={CRACK_ON} palette={{ X: "#2a1b14", H: "#e8c69c", K: "#8a1c12" }} width={width} />
  ) : (
    <PixelArt grid={CRACK_OFF} palette={{ X: "#a77d52", H: "#f8e4c8" }} width={width} />
  );
}
