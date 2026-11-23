import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { drawSky, PERIOD_LABEL, PERIODS, SCENES, starField, type PixelContext } from "./sky";
import { PeriodLabel, SkyBackdrop } from "./SkyBackdrop";

/** Contexto falso que grava cada retângulo pintado. */
function recorder(): PixelContext & { ops: string[] } {
  const ops: string[] = [];
  return {
    ops,
    fillStyle: "#000000",
    fillRect(x, y, w, h) {
      ops.push(`${String(this.fillStyle)} ${x},${y} ${w}x${h}`);
    },
    clearRect() {
      ops.push("clear");
    },
  };
}

afterEach(() => {
  document.documentElement.classList.remove("motion-reduced");
});

describe("desenho do céu", () => {
  it("tem os seis períodos, cada um com astro e bandas", () => {
    expect(PERIODS).toEqual(["madrugada", "amanhecer", "manha", "tarde", "entardecer", "noite"]);
    for (const period of PERIODS) {
      expect(SCENES[period].bands.length).toBeGreaterThanOrEqual(4);
      expect(PERIOD_LABEL[period]).toBeTruthy();
    }
    expect(SCENES.noite.body.kind).toBe("moon");
    expect(SCENES.madrugada.body.kind).toBe("moon");
    expect(SCENES.manha.body.kind).toBe("sun");
    expect(SCENES.entardecer.body.kind).toBe("sun");
  });

  it("é determinístico: mesmas entradas, mesmos pixels", () => {
    const a = recorder();
    const b = recorder();
    drawSky(a, 120, 32, "noite");
    drawSky(b, 120, 32, "noite");
    expect(a.ops).toEqual(b.ops);
    expect(a.ops.length).toBeGreaterThan(100);
  });

  it("cada período desenha um céu diferente", () => {
    const drawings = PERIODS.map((period) => {
      const ctx = recorder();
      drawSky(ctx, 120, 32, period);
      return ctx.ops.join("|");
    });
    expect(new Set(drawings).size).toBe(PERIODS.length);
  });

  it("só pinta em coordenadas inteiras (pixels da arte)", () => {
    const ctx = recorder();
    drawSky(ctx, 97, 29, "entardecer");
    for (const op of ctx.ops.filter((o) => o !== "clear")) {
      expect(op).toMatch(/^#[0-9a-f]{6} -?\d+,-?\d+ \d+x\d+$/);
    }
  });

  it("estrelas determinísticas; mais à noite, nenhuma de manhã", () => {
    expect(starField(100, 30, SCENES.noite.stars)).toEqual(starField(100, 30, SCENES.noite.stars));
    expect(starField(100, 30, SCENES.noite.stars).length).toBeGreaterThan(starField(100, 30, SCENES.madrugada.stars).length);
    expect(starField(100, 30, SCENES.manha.stars)).toEqual([]);
  });
});

describe("SkyBackdrop", () => {
  it("é decorativo e informa o período", () => {
    const { container } = render(<SkyBackdrop period="entardecer" />);
    const sky = container.querySelector(".sky");
    expect(sky).toHaveAttribute("aria-hidden", "true");
    expect(sky).toHaveAttribute("data-period", "entardecer");
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("troca de período com crossfade: a camada nova entra por cima", () => {
    const { container, rerender } = render(<SkyBackdrop period="tarde" />);
    rerender(<SkyBackdrop period="noite" />);
    const layers = container.querySelectorAll("canvas");
    expect(layers).toHaveLength(2);
    expect(layers[1]).toHaveAttribute("data-period", "noite");
    expect(layers[1]).toHaveClass("sky__layer--enter");
  });

  it("com movimento reduzido a troca é imediata", () => {
    document.documentElement.classList.add("motion-reduced");
    const { container, rerender } = render(<SkyBackdrop period="tarde" />);
    rerender(<SkyBackdrop period="noite" />);
    const layers = container.querySelectorAll("canvas");
    expect(layers).toHaveLength(1);
    expect(layers[0]).toHaveAttribute("data-period", "noite");
  });
});

describe("PeriodLabel", () => {
  it("diz o período em texto", () => {
    render(<PeriodLabel period="manha" />);
    expect(screen.getByText("Manhã")).toBeInTheDocument();
    expect(screen.getByText("Período do dia:")).toBeInTheDocument();
  });
});
