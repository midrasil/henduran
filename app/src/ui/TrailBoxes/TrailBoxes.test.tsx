import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { trailText, TrailBoxes } from "./TrailBoxes";

describe("TrailBoxes", () => {
  it("desenha uma caixa por espaço, com texto equivalente", () => {
    const { container } = render(<TrailBoxes label="Vida" size={6} superficial={2} agravada={1} legend />);
    expect(screen.getByRole("img", { name: "Vida: 6 espaços; 2 superficiais, 1 agravado, 3 vazios" })).toBeInTheDocument();
    const boxes = container.querySelectorAll(".trail__boxes .trail__box");
    expect(boxes).toHaveLength(6);
    expect(container.querySelectorAll(".trail__boxes .trail__box--agravada")).toHaveLength(1);
    expect(container.querySelectorAll(".trail__boxes .trail__box--superficial")).toHaveLength(2);
    expect(screen.getByText("superficial")).toBeInTheDocument();
  });

  it("sem tamanho ainda", () => {
    render(<TrailBoxes label="Vontade" size={null} />);
    expect(screen.getByRole("img", { name: "Vontade: ainda sem tamanho" })).toBeInTheDocument();
    expect(trailText("Vida", 1, 0, 0)).toBe("Vida: 1 espaço; 0 superficiais, 0 agravados, 1 vazio");
  });
});
