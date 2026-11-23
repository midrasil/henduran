import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Track, trackCells, trackText } from "./Track";

const states = (container: HTMLElement) =>
  [...container.querySelectorAll(".track__cells .track__cell")].map((el) => el.className.replace(/.*track__cell--/, ""));

describe("Track", () => {
  it("ordem da regra: agravado à esquerda, superficial depois, livres à direita", () => {
    expect(trackCells(6, 2, 1)).toEqual(["agravado", "superficial", "superficial", "livre", "livre", "livre"]);
    const { container } = render(<Track label="Vida" kind="heart" size={6} superficial={2} agravada={1} />);
    expect(states(container)).toEqual(["agravado", "superficial", "superficial", "livre", "livre", "livre"]);
  });

  it.each([
    ["nenhum", 0, 0, "Vida: 0 agravados, 0 superficiais, 6 livres de 6", "sem dano"],
    ["superficial", 2, 0, "Vida: 0 agravados, 2 superficiais, 4 livres de 6", "2 superficiais"],
    ["misto", 2, 1, "Vida: 1 agravado, 2 superficiais, 3 livres de 6", "1 agravado"],
    ["trilha cheia", 5, 1, "Vida: 1 agravado, 5 superficiais, 0 livres de 6", "5 superficiais"],
    ["toda agravada", 0, 6, "Vida: 6 agravados, 0 superficiais, 0 livres de 6", "6 agravados"],
  ])("caso %s: rótulo acessível e legenda com as contagens", (_name, sup, agr, label, legend) => {
    const { container } = render(<Track label="Vida" kind="heart" size={6} superficial={sup} agravada={agr} />);
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
    expect(container.querySelector(".track__legend")).toHaveTextContent(legend);
    expect(container.querySelector(".track__count")).toHaveTextContent(`${6 - sup - agr}/6`);
  });

  it("sem dados de estado do serviço, não mostra estado (Debilitado etc.)", () => {
    const { container } = render(<Track label="Vida" kind="heart" size={6} superficial={6} />);
    expect(container.querySelector(".track__status")).toBeNull();
    render(<Track label="Vontade" kind="flame" size={6} superficial={6} status="Debilitado" />);
    expect(screen.getByText("Debilitado")).toBeInTheDocument();
  });

  it("sem tamanho ainda", () => {
    render(<Track label="Vontade" kind="flame" size={null} />);
    expect(screen.getByRole("img", { name: "Vontade: ainda sem tamanho" })).toBeInTheDocument();
    expect(trackText("Vida", 1)).toBe("Vida: 0 agravados, 0 superficiais, 1 livre de 1");
  });
});
