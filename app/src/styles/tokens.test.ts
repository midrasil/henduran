// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { contrastRatio, parseContrastPairs, parseCustomProperties } from "../ui/contrast";

const stylesDir = fileURLToPath(new URL(".", import.meta.url));
const srcDir = join(stylesDir, "..");
const css = readFileSync(join(stylesDir, "tokens.css"), "utf8");
const tokens = parseCustomProperties(css);
const pairs = parseContrastPairs(css);

/** Divide `text` por `sep` fora de parênteses. */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text.replace(/\s+/g, " ").trim()) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  out.push(current.trim());
  return out.filter(Boolean);
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

describe("tokens de cor — contraste WCAG AA", () => {
  it("declara os pares de contraste", () => {
    expect(pairs.length).toBeGreaterThan(30);
  });

  it.each(pairs.map((p) => [`${p.fg} sobre ${p.bg} (mín. ${p.min})`, p] as const))("%s", (_label, pair) => {
    const fg = tokens.get(pair.fg);
    const bg = tokens.get(pair.bg);
    expect(fg, pair.fg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(bg, pair.bg).toMatch(/^#[0-9a-f]{6}$/i);
    const ratio = contrastRatio(fg!, bg!);
    expect(ratio, `${pair.fg} ${fg} / ${pair.bg} ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(pair.min);
  });
});

describe("tokens de forma (ADR-069)", () => {
  it("raio zero", () => {
    expect(tokens.get("--radius")).toBe("0");
  });

  it("bordas e sombras em pixels inteiros de 2 a 4", () => {
    for (const name of ["--border-thin", "--border-frame", "--bevel", "--shadow-drop"]) {
      const m = /^(\d+)px$/.exec(tokens.get(name) ?? "");
      expect(m, name).not.toBeNull();
      const px = Number(m![1]);
      expect(px).toBeGreaterThanOrEqual(2);
      expect(px).toBeLessThanOrEqual(4);
    }
  });

  it("espaçamento em múltiplos de 8 px", () => {
    const spaces = [...tokens.entries()].filter(([name]) => name.startsWith("--space-"));
    expect(spaces.length).toBeGreaterThan(3);
    for (const [name, value] of spaces) {
      const px = Number(/^(\d+)px$/.exec(value)?.[1]);
      expect(px % 8, `${name} = ${value}`).toBe(0);
    }
  });

  it("tamanhos de fonte dependem de --text-scale", () => {
    const sizes = [...tokens.entries()].filter(([name]) => name.startsWith("--font-size-"));
    expect(sizes.length).toBeGreaterThan(3);
    for (const [name] of sizes) {
      // o valor bruto (antes de resolver) usa a escala de texto
      expect(css).toMatch(new RegExp(`${name}:\\s*calc\\([^;]*var\\(--text-scale\\)`));
    }
  });

  it("nenhuma folha de estilo usa blur nem cantos arredondados", () => {
    for (const file of cssFiles(srcDir)) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(text, file).not.toMatch(/blur\(/);
      for (const m of text.matchAll(/border-radius\s*:\s*([^;]+);/g)) {
        expect(m[1]!.trim(), file).toMatch(/^(0|var\(--radius\))$/);
      }
      // sombras sem desfoque: em "x y desfoque espalhamento cor", o desfoque é zero
      for (const m of text.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
        for (const layer of splitTopLevel(m[1]!, ",")) {
          const parts = splitTopLevel(layer, " ").filter((p) => p && p !== "inset");
          if (parts.length >= 4) expect(parts[2], `${file}: ${layer.trim()}`).toMatch(/^0(px)?$/);
        }
      }
    }
  });
});
