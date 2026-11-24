import { describe, expect, it } from "vitest";

import { PERIODS } from "../../ui";
import type { PixelContext } from "../../ui/SkyBackdrop/sky";
import { drawLandscapeBase, drawLandscapeLayers, hasMotion } from "./landscape";
import { castlePlacement } from "./MenuLandscape";

/** Contexto que só anota os retângulos (cor e posição). */
function recorder() {
  const calls: string[] = [];
  const ctx: PixelContext = {
    fillStyle: "#000",
    fillRect(x, y, w, h) {
      calls.push(`${String(this.fillStyle)} ${x},${y},${w},${h}`);
    },
    clearRect() {
      calls.length = 0;
    },
  };
  return { ctx, calls };
}

describe("paisagem do menu", () => {
  it("camadas animadas por período: pássaros de dia, vaga-lumes ao entardecer e à noite, estrelas à noite", () => {
    const layers = Object.fromEntries(PERIODS.map((p) => [p, drawLandscapeBase(recorder().ctx, 320, 180, p)]));
    expect(layers.manha!.birds.length).toBeGreaterThan(0);
    expect(layers.tarde!.birds.length).toBeGreaterThan(0);
    expect(layers.noite!.birds).toHaveLength(0);
    expect(layers.entardecer!.flies.length).toBeGreaterThan(0);
    expect(layers.noite!.flies.length).toBeGreaterThan(0);
    expect(layers.manha!.flies).toHaveLength(0);
    expect(layers.noite!.stars.length).toBeGreaterThan(layers.madrugada!.stars.length);
    expect(layers.manha!.stars).toHaveLength(0);
    expect(layers.manha!.clouds.length).toBeGreaterThan(0);
    for (const p of PERIODS) expect(hasMotion(layers[p]!)).toBe(true);
  });

  it("é determinística e, parada (movimento reduzido), não muda entre quadros", () => {
    const a = recorder();
    const b = recorder();
    drawLandscapeBase(a.ctx, 200, 120, "noite");
    drawLandscapeBase(b.ctx, 200, 120, "noite");
    expect(a.calls).toEqual(b.calls);
    // Castelos com janelas acesas à noite.
    expect(a.calls.some((c) => c.startsWith("#f0c050 "))).toBe(true);

    const layers = drawLandscapeBase(recorder().ctx, 200, 120, "entardecer");
    const frame = (tick: number, still: boolean) => {
      const r = recorder();
      drawLandscapeLayers(r.ctx, layers, tick, still);
      return r.calls;
    };
    expect(frame(0, true)).toEqual(frame(37, true));
    expect(frame(0, false)).not.toEqual(frame(37, false));
  });
  it("castelos fora do cartão em telas largas; nas estreitas, a 14% da borda", () => {
    expect(castlePlacement(1024, 4, 320, 340)).toEqual({ x: 0.14, towersOut: false });
    expect(castlePlacement(1920, 4, 320, 340)).toEqual({ x: 0.14, towersOut: false });
    const wide = castlePlacement(1440, 4, 320, 340);
    expect(wide.towersOut).toBe(false);
    // Borda esquerda do castelo da direita depois do cartão (720 + 160 + 56 + 340 = 1276).
    expect((1 - wide.x) * 1440 - 36).toBeGreaterThan(1276);
    expect(castlePlacement(1280, 4, 320, 340).towersOut).toBe(true);
  });
});
