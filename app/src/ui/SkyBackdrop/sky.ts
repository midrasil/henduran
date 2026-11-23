/**
 * Céu de dia e noite desenhado em código (docs/ui-ux/07-ambiente-dia-noite.md):
 * bandas discretas de cor com uma linha pontilhada de transição, astro em pixel
 * art, estrelas determinísticas e silhueta de relevo e árvores. Cada "pixel" da
 * arte é um pixel do canvas; o canvas é ampliado com `image-rendering: pixelated`.
 */

export type DayPeriod = "madrugada" | "amanhecer" | "manha" | "tarde" | "entardecer" | "noite";

export const PERIODS: readonly DayPeriod[] = ["madrugada", "amanhecer", "manha", "tarde", "entardecer", "noite"];

export const PERIOD_LABEL: Record<DayPeriod, string> = {
  madrugada: "Madrugada",
  amanhecer: "Amanhecer",
  manha: "Manhã",
  tarde: "Tarde",
  entardecer: "Entardecer",
  noite: "Noite",
};

/** O período padrão enquanto não há Jornada (07-ambiente-dia-noite.md, seção 3). */
export const DEFAULT_PERIOD: DayPeriod = "entardecer";

export const isNightPeriod = (period: DayPeriod) => period === "noite" || period === "madrugada";

export interface SkyScene {
  /** Cores do céu, de cima para baixo. */
  bands: string[];
  body: {
    kind: "sun" | "moon";
    /** Posição do centro em fração da largura e da altura. */
    x: number;
    y: number;
    /** Raio em fração da altura. */
    r: number;
    color: string;
    core: string;
    /** Halo pontilhado em volta (só sol). */
    halo?: string;
  };
  /** Estrelas por 100 pixels de arte da metade de cima (0 = nenhuma). */
  stars: number;
  starColor: string;
  clouds?: string;
  far: string;
  near: string;
}

export const SCENES: Record<DayPeriod, SkyScene> = {
  madrugada: {
    bands: ["#0b0b24", "#11143a", "#191d4a", "#232a5c", "#2e3468"],
    body: { kind: "moon", x: 0.16, y: 0.62, r: 0.16, color: "#b9bfdc", core: "#dfe2f4" },
    stars: 1.2,
    starColor: "#8f93c0",
    far: "#1b1c3e",
    near: "#0c0b1e",
  },
  amanhecer: {
    bands: ["#3a2a5c", "#6a3768", "#a8486f", "#de6f6c", "#f39b70", "#f8c07a"],
    body: { kind: "sun", x: 0.26, y: 0.86, r: 0.2, color: "#ffc768", core: "#fff0b8", halo: "#ffdf98" },
    stars: 0.3,
    starColor: "#e0c0dc",
    clouds: "#f6b48a",
    far: "#5c3458",
    near: "#2a1a2e",
  },
  manha: {
    bands: ["#2f6cc4", "#3f80d4", "#5797e0", "#73aeea", "#93c6f2"],
    body: { kind: "sun", x: 0.22, y: 0.3, r: 0.16, color: "#fff09a", core: "#ffffff", halo: "#d8ecff" },
    stars: 0,
    starColor: "#ffffff",
    clouds: "#f2f8ff",
    far: "#5a83a8",
    near: "#2c5a3a",
  },
  tarde: {
    bands: ["#2c5aa6", "#3f6fb6", "#5886c2", "#7a9ec8", "#b7b59a"],
    body: { kind: "sun", x: 0.76, y: 0.3, r: 0.17, color: "#ffd878", core: "#fff4c4", halo: "#f4e2a8" },
    stars: 0,
    starColor: "#ffffff",
    clouds: "#f0e6d0",
    far: "#5e6d94",
    near: "#33492f",
  },
  entardecer: {
    bands: ["#24173f", "#3d2160", "#62307a", "#93407a", "#c85c6a", "#ec8a5c", "#f8b868"],
    body: { kind: "sun", x: 0.72, y: 0.78, r: 0.28, color: "#ffb858", core: "#ffe7a0", halo: "#ffcf7c" },
    stars: 0.25,
    starColor: "#d8c4e8",
    clouds: "#e98a74",
    far: "#4a2852",
    near: "#1f1227",
  },
  noite: {
    bands: ["#0a0819", "#110d26", "#191332", "#221a40", "#2c214e"],
    body: { kind: "moon", x: 0.7, y: 0.28, r: 0.17, color: "#e4dfc0", core: "#fbf7e2" },
    stars: 2.2,
    starColor: "#f2ecd4",
    far: "#1c1636",
    near: "#0b0815",
  },
};

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Star {
  x: number;
  y: number;
  big: boolean;
}

/** Estrelas determinísticas para um tamanho de arte; mesmas entradas, mesmas estrelas. */
export function starField(width: number, height: number, density: number, seed = 1729): Star[] {
  if (density <= 0) return [];
  const rand = seeded(seed + width * 31 + height);
  const area = width * Math.floor(height * 0.6);
  const count = Math.round((area / 100) * density);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.floor(rand() * width),
      y: Math.floor(rand() * height * 0.6),
      big: rand() < 0.12,
    });
  }
  return stars;
}

/** Contexto mínimo usado pelo desenho (facilita os testes). */
export interface PixelContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
}

function disc(ctx: PixelContext, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r + r * 0.8 - dy * dy));
    if (Number.isNaN(half)) continue;
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

function ridge(width: number, height: number, seed: number, base: number, amp: number): number[] {
  const rand = seeded(seed);
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const k1 = 2.2 + rand();
  const k2 = 6 + rand() * 3;
  const out: number[] = [];
  for (let x = 0; x < width; x++) {
    const t = x / Math.max(1, width);
    const v = Math.sin(t * k1 * Math.PI + p1) * 0.65 + Math.sin(t * k2 * Math.PI + p2) * 0.35;
    out.push(Math.round(height - base - amp * (v * 0.5 + 0.5)));
  }
  return out;
}

/** Desenha o céu do período num canvas de `width` x `height` pixels de arte. */
export function drawSky(ctx: PixelContext, width: number, height: number, period: DayPeriod): void {
  const scene = SCENES[period];
  ctx.clearRect(0, 0, width, height);

  // Céu em bandas discretas; a primeira linha de cada banda é pontilhada com a cor anterior.
  const bands = scene.bands;
  const bandH = Math.max(1, Math.ceil(height / bands.length));
  bands.forEach((color, i) => {
    const y0 = i * bandH;
    ctx.fillStyle = color;
    ctx.fillRect(0, y0, width, bandH);
    const prev = bands[i - 1];
    if (prev && y0 < height) {
      ctx.fillStyle = prev;
      for (let x = i % 2; x < width; x += 2) ctx.fillRect(x, y0, 1, 1);
    }
  });

  // Estrelas
  ctx.fillStyle = scene.starColor;
  for (const star of starField(width, height, scene.stars)) {
    ctx.fillRect(star.x, star.y, 1, 1);
    if (star.big) {
      ctx.fillRect(star.x - 1, star.y, 3, 1);
      ctx.fillRect(star.x, star.y - 1, 1, 3);
    }
  }

  // Astro
  const body = scene.body;
  const r = Math.max(2, Math.round(height * body.r));
  const cx = Math.round(width * body.x);
  const cy = Math.round(height * body.y);
  if (body.halo) {
    ctx.fillStyle = body.halo;
    const hr = r + 2;
    for (let dy = -hr; dy <= hr; dy++) {
      for (let dx = -hr; dx <= hr; dx++) {
        const d = dx * dx + dy * dy;
        if (d > r * r + r && d <= hr * hr + hr && (dx + dy) % 2 === 0) ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
  if (body.kind === "sun") {
    disc(ctx, cx, cy, r, body.color);
    disc(ctx, cx, cy, Math.max(1, r - 2), body.core);
  } else {
    // Lua crescente: pixels do disco que ficam fora de um segundo disco deslocado
    // (o céu atrás continua visível), com o miolo mais claro.
    const bx = cx + Math.ceil(r * 0.7);
    const by = cy - Math.ceil(r * 0.3);
    const inside = (x: number, y: number, ox: number, oy: number, rr: number) =>
      (x - ox) ** 2 + (y - oy) ** 2 <= rr * rr + rr * 0.8;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!inside(x, y, cx, cy, r) || inside(x, y, bx, by, r)) continue;
        ctx.fillStyle = inside(x, y, cx - 1, cy, r - 2) && !inside(x, y, bx - 1, by, r + 1) ? body.core : body.color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Nuvens (dia): faixas em degraus
  if (scene.clouds) {
    const rand = seeded(97 + width);
    ctx.fillStyle = scene.clouds;
    const count = Math.max(1, Math.round(width / 60));
    for (let i = 0; i < count; i++) {
      const w = 8 + Math.floor(rand() * 10);
      const x = Math.floor(rand() * width);
      const y = Math.floor(height * (0.12 + rand() * 0.3));
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x - 2, y + 1, w + 5, 1);
      ctx.fillRect(x + 2, y - 1, Math.max(2, w - 6), 1);
    }
  }

  // Relevo distante e colina próxima com árvores
  const far = ridge(width, height, 11, Math.round(height * 0.12), Math.round(height * 0.22));
  ctx.fillStyle = scene.far;
  far.forEach((top, x) => ctx.fillRect(x, top, 1, height - top));

  const near = ridge(width, height, 23, Math.round(height * 0.02), Math.round(height * 0.12));
  ctx.fillStyle = scene.near;
  near.forEach((top, x) => ctx.fillRect(x, top, 1, height - top));
  const rand = seeded(41);
  for (let x = 2; x < width - 2; x += 3 + Math.floor(rand() * 5)) {
    if (rand() < 0.35) continue;
    const top = near[x] ?? height;
    const h = 3 + Math.floor(rand() * Math.max(2, height * 0.12));
    for (let i = 0; i < h; i++) {
      const half = Math.floor((i * 2) / h + 0.5);
      ctx.fillRect(x - half, top - h + i, half * 2 + 1, 1);
    }
  }
}
