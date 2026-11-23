/** Contraste WCAG 2.x entre duas cores `#rrggbb` (ou `#rgb`). */

export function parseHex(hex: string): [number, number, number] {
  const value = hex.trim().replace(/^#/, "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`cor inválida: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Custom properties de um texto CSS, com `var()` resolvido. */
export function parseCustomProperties(css: string): Map<string, string> {
  const raw = new Map<string, string>();
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of noComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    raw.set(match[1]!, match[2]!.trim());
  }
  const resolved = new Map<string, string>();
  const resolve = (name: string, depth = 0): string => {
    const value = raw.get(name);
    if (value === undefined) throw new Error(`token não definido: ${name}`);
    if (depth > 10) throw new Error(`referência circular: ${name}`);
    return value.replace(/var\((--[\w-]+)\)/g, (_m, ref: string) => resolve(ref, depth + 1));
  };
  for (const name of raw.keys()) resolved.set(name, resolve(name));
  return resolved;
}

export interface ContrastPair {
  fg: string;
  bg: string;
  min: number;
}

/** Linhas `@contrast <frente> on <fundo> min <razão>` dos comentários. */
export function parseContrastPairs(css: string): ContrastPair[] {
  return [...css.matchAll(/@contrast\s+(--[\w-]+)\s+on\s+(--[\w-]+)\s+min\s+([\d.]+)/g)].map((m) => ({
    fg: m[1]!,
    bg: m[2]!,
    min: Number(m[3]),
  }));
}
