import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("expõe progressbar com valores e rótulo", () => {
    render(<ProgressBar label="Download" value={0.25} />);
    const bar = screen.getByRole("progressbar", { name: "Download" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(bar).toHaveAttribute("aria-valuetext", "25%");
  });

  it("rotulado por outro elemento e com texto de valor próprio", () => {
    render(
      <>
        <p id="n">modelo.gguf</p>
        <ProgressBar labelledBy="n" value={0.5} valueText="metade" />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "modelo.gguf" })).toHaveAttribute("aria-valuetext", "metade");
  });

  it("limita o valor entre 0 e 100 e define a largura por CSSOM", () => {
    const { rerender } = render(<ProgressBar label="x" value={1.7} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<ProgressBar label="x" value={-1} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar.querySelector<HTMLElement>(".progress__fill")?.style.getPropertyValue("--progress")).toBe("0");
    expect(bar.querySelector(".progress__fill")).not.toHaveAttribute("style", expect.stringContaining("width"));
  });

  it("indeterminado não tem aria-valuenow", () => {
    render(<ProgressBar label="Carregando" value={null} />);
    expect(screen.getByRole("progressbar", { name: "Carregando" })).not.toHaveAttribute("aria-valuenow");
  });
});
