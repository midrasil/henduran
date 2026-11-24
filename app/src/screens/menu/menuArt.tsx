/**
 * Desenhos em pixel do menu inicial (protótipo aprovado `prototipos/menu-inicial.html`):
 * rosa dos ventos do título, losango, cantos dourados da moldura, estandartes e o livro
 * do botão Jornadas. Todos decorativos (`aria-hidden`).
 */
import { PixelArt, type PixelGrid, type PixelPalette } from "../../ui";

const GOLD_200 = "#f8d878";
const GOLD_400 = "#f0c050";
const GOLD_600 = "#a8701c";
const INK_950 = "#0e0911";
const BROWN_700 = "#5c4230";

const LINE: PixelPalette = { "#": "currentColor" };

/** Rosa dos ventos em pixel (13x13), dos dois lados do título. */
export const COMPASS: PixelGrid = [
  "......#......",
  "......#......",
  ".....###.....",
  "..#..###..#..",
  "...#.###.#...",
  "....#####....",
  "#############",
  "....#####....",
  "...#.###.#...",
  "..#..###..#..",
  ".....###.....",
  "......#......",
  "......#......",
];

const DIAMOND: PixelGrid = ["...#...", "..#.#..", ".#...#.", "#..#..#", ".#...#.", "..#.#..", "...#..."];

const CORNER: PixelGrid = [
  "##########",
  "#gggggggg#",
  "#g########",
  "#g#.......",
  "#g#.......",
  "#g#.......",
  "#g#.......",
  "#g#.......",
  "#g#.......",
  "###.......",
];

const BOOK: PixelGrid = ["........", "###..###", "#..##..#", "#..##..#", "#..##..#", "#..##..#", "########", "........"];

/** Pano do estandarte: moldura dourada em cima, losango no meio e ponta em V. */
const BANNER: PixelGrid = [
  "TTTTTTTTTTTTTT",
  ".GGGGGGGGGGGG.",
  ".CCCCCCCCCCCC.",
  ".CCCCCCCCCCCC.",
  ".CCCCCYYCCCCC.",
  ".CCCCYYYYCCCC.",
  ".CCCYYYYYYCCC.",
  ".CCCCYYYYCCCC.",
  ".CCCCCYYCCCCC.",
  ".CCCCCCCCCCCC.",
  ".CCCCCCCCCCCC.",
  ".DCCCCCCCCCCD.",
  ".DCCCCCCCCCCD.",
  ".DDCCCCCCCCDD.",
  "..DDCCCCCCDD..",
  "...DDCCCCDD...",
  "....DDCCDD....",
  ".....DDDD.....",
  "......##......",
];

export function CompassMark({ width, className }: { width: number; className?: string }) {
  return <PixelArt grid={COMPASS} palette={{ "#": GOLD_200 }} width={width} {...(className ? { className } : {})} />;
}

export function Diamond({ width = 14, className }: { width?: number; className?: string }) {
  return <PixelArt grid={DIAMOND} palette={{ "#": GOLD_400 }} width={width} {...(className ? { className } : {})} />;
}

export function FrameCorner({ className }: { className: string }) {
  return (
    <span className={`menu-corner ${className}`} aria-hidden="true">
      <PixelArt grid={CORNER} palette={{ "#": GOLD_600, g: GOLD_200 }} width={56} />
    </span>
  );
}

export function BookIcon({ width = 24 }: { width?: number }) {
  return <PixelArt grid={BOOK} palette={LINE} width={width} />;
}

/** Estandarte pendurado na lateral; `side` escolhe a cor (vermelho à esquerda, roxo à direita). */
export function Banner({ side }: { side: "left" | "right" }) {
  const palette: PixelPalette =
    side === "left"
      ? { T: BROWN_700, G: GOLD_200, C: "#6b1420", D: "#4a0d16", Y: GOLD_400, "#": INK_950 }
      : { T: BROWN_700, G: GOLD_200, C: "#45186a", D: "#2e1048", Y: GOLD_400, "#": INK_950 };
  return (
    <span className={`menu-banner menu-banner--${side}`} aria-hidden="true">
      <span className="menu-banner__sway">
        <PixelArt grid={BANNER} palette={palette} width={72} />
      </span>
    </span>
  );
}
