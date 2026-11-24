/**
 * Paisagem viva do menu inicial (docs/ui-ux/11-menu-inicial.md, itens 1 e 2): o céu do
 * período com as mesmas cores de `sky.ts`, relevo distante, colinas, um castelo em
 * silhueta de cada lado (simetria) e árvores no primeiro plano. Por cima, camadas
 * animadas em passos de pixel: estrelas piscando, nuvens passando, pássaros e
 * vaga-lumes. Desenho do protótipo aprovado (`prototipos/menu-inicial.html`).
 *
 * A base (tudo o que não se mexe) é desenhada uma vez por período e tamanho; cada
 * quadro copia a base e desenha as camadas animadas no instante `tick`.
 */
import { drawBody, ridge, SCENES, seeded, type DayPeriod, type PixelContext, type SkyScene } from "../../ui/SkyBackdrop/sky";

/** Quadros por segundo da animação (passos de pixel). */
export const LANDSCAPE_FPS = 10;

interface MenuExtras {
  /** Astro menor e mais alto que na faixa do céu: a paisagem ocupa a tela toda. */
  body: { x: number; y: number; r: number };
  /** Colinas do meio, onde ficam os castelos. */
  mid: string;
  /** Janelas acesas dos castelos (sem a cor, apagadas). */
  light?: string;
  birds?: boolean;
  flies?: boolean;
}

const EXTRAS: Record<DayPeriod, MenuExtras> = {
  // Astros fora da faixa do título (30% a 70% da largura) e do cartão (à direita da coluna, em telas
  // largas): os altos ficam nas laterais (16% ou 84%); o do entardecer se põe à esquerda, atrás das colinas.
  madrugada: { body: { x: 0.16, y: 0.3, r: 0.07 }, mid: "#141532", light: "#e8c070" },
  amanhecer: { body: { x: 0.24, y: 0.6, r: 0.08 }, mid: "#432644", light: "#ffd890" },
  manha: { body: { x: 0.16, y: 0.22, r: 0.065 }, mid: "#3f6a58", birds: true },
  tarde: { body: { x: 0.84, y: 0.2, r: 0.07 }, mid: "#465a44", birds: true },
  entardecer: { body: { x: 0.22, y: 0.6, r: 0.1 }, mid: "#331b3c", light: "#ffcf70", flies: true },
  noite: { body: { x: 0.84, y: 0.2, r: 0.07 }, mid: "#140f28", light: "#f0c050", flies: true },
};

const FLAG = "#8a1c12";
const FIREFLY = "#f8f0a0";
const BIRD = "#1e2a44";

interface Star {
  x: number;
  y: number;
  big: boolean;
  ph: number;
}
interface Cloud {
  x: number;
  y: number;
  w: number;
  v: number;
}
interface Firefly {
  x: number;
  y: number;
  ph: number;
  sp: number;
}
interface Bird {
  x: number;
  y: number;
  v: number;
  ph: number;
}

/** Camadas animadas de um período e tamanho (determinísticas). */
export interface LandscapeLayers {
  period: DayPeriod;
  width: number;
  height: number;
  stars: Star[];
  clouds: Cloud[];
  flies: Firefly[];
  birds: Bird[];
}

/** Largura do castelo em pixels de arte (a mesma usada no desenho). */
export const castleWidth = (width: number) => Math.max(18, Math.round(width * 0.05));

function castle(ctx: PixelContext, cx: number, ridgeTops: number[], width: number, height: number, mid: string, light: string | undefined, dir: 1 | -1) {
  ctx.fillStyle = mid;
  const w = castleWidth(width);
  const h = Math.max(14, Math.round(height * 0.08));
  const left = Math.round(cx - w / 2);
  const groundY = ridgeTops[cx] ?? height;
  // A base desce até o ponto mais baixo da colina sob o castelo: em encosta, nada flutua.
  let base = groundY;
  for (let x = Math.max(0, left); x < Math.min(width, left + w); x++) base = Math.max(base, ridgeTops[x] ?? height);
  ctx.fillRect(left, groundY - h, w, base - groundY + h + 2);
  for (let x = left; x < left + w; x += 3) ctx.fillRect(x, groundY - h - 2, 2, 2);
  const tx = Math.round(cx + dir * (w / 2 - 3));
  ctx.fillRect(tx - 3, groundY - h - 10, 7, 10);
  for (let x = tx - 3; x < tx + 4; x += 3) ctx.fillRect(x, groundY - h - 12, 2, 2);
  ctx.fillRect(tx, groundY - h - 16, 1, 4);
  ctx.fillStyle = FLAG;
  ctx.fillRect(dir === 1 ? tx + 1 : tx - 3, groundY - h - 16, 3, 2);
  if (!light) return;
  ctx.fillStyle = light;
  const rand = seeded(cx);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.round(left + 3 + rand() * (w - 6)), Math.round(groundY - h + 3 + rand() * (h - 6)), 1, 1);
  }
  ctx.fillRect(tx, groundY - h - 6, 1, 1);
}

/** Desenha a parte fixa da paisagem e devolve as camadas animadas. */
export interface LandscapeOptions {
  /**
   * Centro do castelo da esquerda, em fração da largura (o da direita é simétrico).
   * Padrão 0,14; em telas largas o menu afasta os castelos para não ficarem atrás do cartão.
   */
  castleX?: number;
  /** Torres viradas para fora (para as bordas) em vez de para o centro. */
  towersOut?: boolean;
}

export function drawLandscapeBase(ctx: PixelContext, width: number, height: number, period: DayPeriod, options: LandscapeOptions = {}): LandscapeLayers {
  const scene: SkyScene = SCENES[period];
  const extra = EXTRAS[period];
  ctx.clearRect(0, 0, width, height);

  // Céu em bandas (até 72% da altura; a última vai até o chão), com a linha pontilhada da banda anterior.
  const bands = scene.bands;
  const bandH = Math.max(1, Math.ceil((height * 0.72) / bands.length));
  bands.forEach((color, i) => {
    const y0 = i * bandH;
    ctx.fillStyle = color;
    ctx.fillRect(0, y0, width, i === bands.length - 1 ? height : bandH);
    const prev = bands[i - 1];
    if (prev) {
      ctx.fillStyle = prev;
      for (let x = i % 2; x < width; x += 2) ctx.fillRect(x, y0, 1, 1);
    }
  });

  const rs = seeded(1729);
  const stars: Star[] = [];
  const count = Math.round(width * height * 0.0012 * scene.stars);
  for (let i = 0; i < count; i++) {
    stars.push({ x: Math.floor(rs() * width), y: Math.floor(rs() * height * 0.55), big: rs() < 0.1, ph: rs() * Math.PI * 2 });
  }

  const body = { ...scene.body, ...extra.body };
  drawBody(ctx, body, Math.round(width * body.x), Math.round(height * body.y), Math.max(3, Math.round(height * body.r)));

  // Relevo distante, colinas do meio (com os castelos) e primeiro plano com árvores.
  const far = ridge(width, height, 11, Math.round(height * 0.26), Math.round(height * 0.2));
  ctx.fillStyle = scene.far;
  far.forEach((top, x) => ctx.fillRect(x, top, 1, height - top));
  const mid = ridge(width, height, 17, Math.round(height * 0.16), Math.round(height * 0.12));
  ctx.fillStyle = extra.mid;
  mid.forEach((top, x) => ctx.fillRect(x, top, 1, height - top));
  const leftX = Math.round(width * (options.castleX ?? 0.14));
  const rightX = width - 1 - leftX;
  const inward = options.towersOut ? -1 : 1;
  castle(ctx, leftX, mid, width, height, extra.mid, extra.light, inward);
  castle(ctx, rightX, mid, width, height, extra.mid, extra.light, inward === 1 ? -1 : 1);
  const near = ridge(width, height, 23, Math.round(height * 0.03), Math.round(height * 0.09));
  ctx.fillStyle = scene.near;
  near.forEach((top, x) => ctx.fillRect(x, top, 1, height - top));
  const rt = seeded(41);
  for (let x = 2; x < width - 2; x += 3 + Math.floor(rt() * 5)) {
    if (rt() < 0.3) continue;
    const top = near[x] ?? height;
    const h = 4 + Math.floor(rt() * height * 0.06);
    for (let i = 0; i < h; i++) {
      const half = Math.floor((i * 2) / h + 0.5);
      ctx.fillRect(x - half, top - h + i, half * 2 + 1, 1);
    }
  }

  const rc = seeded(97 + width);
  const clouds: Cloud[] = [];
  if (scene.clouds) {
    for (let i = 0; i < Math.max(3, Math.round(width / 50)); i++) {
      clouds.push({ x: rc() * width, y: Math.floor(height * (0.08 + rc() * 0.3)), w: 10 + Math.floor(rc() * 16), v: 0.04 + rc() * 0.06 });
    }
  }
  const rf = seeded(7);
  const flies: Firefly[] = [];
  if (extra.flies) {
    for (let i = 0; i < 26; i++) flies.push({ x: rf() * width, y: height * (0.7 + rf() * 0.25), ph: rf() * Math.PI * 2, sp: 0.02 + rf() * 0.03 });
  }
  const rb = seeded(3);
  const birds: Bird[] = [];
  if (extra.birds) {
    for (let i = 0; i < 4; i++) birds.push({ x: rb() * width, y: height * (0.15 + rb() * 0.2), v: 0.12 + rb() * 0.08, ph: rb() * 2 });
  }
  return { period, width, height, stars, clouds, flies, birds };
}

/**
 * Camadas animadas no quadro `tick`. Com `still` (movimento reduzido), tudo fica parado
 * e aceso: estrelas e vaga-lumes visíveis, nuvens e pássaros na posição inicial.
 */
export function drawLandscapeLayers(ctx: PixelContext, layers: LandscapeLayers, tick: number, still: boolean): void {
  const scene = SCENES[layers.period];
  const { width, height } = layers;
  ctx.fillStyle = scene.starColor;
  for (const s of layers.stars) {
    if (!still && Math.sin(tick * 0.05 + s.ph) <= -0.6) continue;
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.big) {
      ctx.fillRect(s.x - 1, s.y, 3, 1);
      ctx.fillRect(s.x, s.y - 1, 1, 3);
    }
  }
  if (scene.clouds) {
    ctx.fillStyle = scene.clouds;
    for (const c of layers.clouds) {
      const x = Math.round(still ? c.x : ((c.x + tick * c.v) % (width + 40)) - 20);
      ctx.fillRect(x, c.y, c.w, 1);
      ctx.fillRect(x - 3, c.y + 1, c.w + 7, 1);
      ctx.fillRect(x + 3, c.y - 1, Math.max(2, c.w - 8), 1);
    }
  }
  ctx.fillStyle = BIRD;
  for (const b of layers.birds) {
    const x = Math.round(still ? b.x : ((b.x + tick * b.v) % (width + 20)) - 10);
    const y = Math.round(b.y + (still ? 0 : Math.sin(tick * 0.05 + b.ph) * 2));
    const up = !still && Math.floor(tick / 6 + b.ph) % 2 === 1;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 1, y - (up ? 1 : 0), 1, 1);
    ctx.fillRect(x + 1, y - (up ? 1 : 0), 1, 1);
    ctx.fillRect(x - 2, y - (up ? 2 : 0), 1, 1);
    ctx.fillRect(x + 2, y - (up ? 2 : 0), 1, 1);
  }
  ctx.fillStyle = FIREFLY;
  for (const f of layers.flies) {
    const k = still ? 0 : tick * f.sp;
    if (!still && Math.sin(tick * 0.08 + f.ph * 3) <= 0) continue;
    const x = Math.round(f.x + Math.sin(k + f.ph) * 6);
    const y = Math.round(f.y + Math.cos(k * 1.3 + f.ph) * 3);
    ctx.fillRect(x, Math.min(height - 1, y), 1, 1);
  }
}

/** O período tem camadas que se mexem? (Sem nenhuma, não há laço de animação.) */
export function hasMotion(layers: LandscapeLayers): boolean {
  return layers.stars.length + layers.clouds.length + layers.flies.length + layers.birds.length > 0;
}
