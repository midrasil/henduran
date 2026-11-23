import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Panel } from "./Panel";

describe("Panel", () => {
  it("com título vira uma região rotulada pelo título", () => {
    render(
      <Panel title="Hardware deste PC">
        <p>conteúdo</p>
      </Panel>,
    );
    expect(screen.getByRole("region", { name: "Hardware deste PC" })).toHaveTextContent("conteúdo");
    expect(screen.getByRole("heading", { level: 3, name: "Hardware deste PC" })).toBeInTheDocument();
  });

  it("variante pergaminho usa a superfície de pergaminho", () => {
    render(<Panel variant="parchment" title="Pergaminho" />);
    expect(screen.getByRole("region", { name: "Pergaminho" })).toHaveClass("panel--parchment", "surface-parchment");
  });

  it("nível do título configurável e título focável por ref", () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<Panel title="Lista" titleLevel={2} titleRef={ref} />);
    const heading = screen.getByRole("heading", { level: 2, name: "Lista" });
    expect(ref.current).toBe(heading);
    ref.current?.focus();
    expect(heading).toHaveFocus();
  });

  it("sem título e como div não cria região", () => {
    render(<Panel as="div">solto</Panel>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByText("solto")).toBeInTheDocument();
  });
});
