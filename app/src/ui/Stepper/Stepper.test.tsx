import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Stepper } from "./Stepper";

const STEPS = [
  { id: "a", label: "Mundo" },
  { id: "b", label: "Protagonista" },
  { id: "c", label: "Revisão" },
];

describe("Stepper", () => {
  it("marca o passo atual e diz o estado em texto", () => {
    render(<Stepper steps={STEPS} current={1} label="Passos" />);
    const nav = screen.getByRole("navigation", { name: "Passos" });
    const items = screen.getAllByRole("listitem");
    expect(nav).toContainElement(items[0]!);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("Mundo (concluído)");
    expect(items[1]).toHaveTextContent("Protagonista (passo atual)");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("passos anteriores viram botões; os seguintes, não", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Stepper steps={STEPS} current={2} label="Passos" onSelect={onSelect} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Mundo/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
