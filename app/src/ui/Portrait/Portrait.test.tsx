import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { clampCrop, cropBox, initials, Portrait } from "./Portrait";

describe("Portrait", () => {
  it("sem retrato mostra as iniciais; com onClick é um botão", () => {
    const onClick = vi.fn();
    render(<Portrait name="Ilsa de Vel" src={null} onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Trocar o retrato de Ilsa de Vel" });
    expect(button).toHaveTextContent("IV");
    button.click();
    expect(onClick).toHaveBeenCalled();
    expect(initials("Bram")).toBe("B");
    expect(initials("  ")).toBe("?");
  });

  it("sem onClick é uma imagem com rótulo", () => {
    render(<Portrait name="Bram" src="blob:x" />);
    expect(screen.getByRole("img", { name: "Retrato de Bram" })).toBeInTheDocument();
  });

  it("enquadramento: zoom 1 cobre o quadro pelo lado menor e o centro fica no meio", () => {
    expect(cropBox({ w: 200, h: 100 }, { x: 0.5, y: 0.5, zoom: 1 })).toEqual({ width: 200, height: 100, left: -50, top: 0 });
    expect(cropBox({ w: 100, h: 100 }, { x: 0.5, y: 0.5, zoom: 2 })).toEqual({ width: 200, height: 200, left: -50, top: -50 });
  });

  it("o centro não deixa o quadro sair da imagem", () => {
    expect(clampCrop({ w: 100, h: 100 }, { x: 0, y: 1, zoom: 1 })).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(clampCrop({ w: 100, h: 100 }, { x: 0, y: 1, zoom: 2 })).toEqual({ x: 0.25, y: 0.75, zoom: 2 });
    expect(clampCrop(null, { x: 2, y: -1, zoom: 9 })).toEqual({ x: 1, y: 0, zoom: 8 });
  });
});
