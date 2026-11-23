import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./Select";

const OPTIONS = [
  { value: "4", label: "4" },
  { value: "3", label: "3" },
];

describe("Select", () => {
  it("rótulo, opção vazia e escolha pelo teclado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Força" hint="potência física" placeholder="—" options={OPTIONS} value="" onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Força" });
    expect(select).toHaveAccessibleDescription("potência física");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.selectOptions(select, "3");
    expect(onChange).toHaveBeenCalled();
  });

  it("erro marca inválido e entra na descrição", () => {
    render(<Select label="Vigor" options={OPTIONS} error="O valor 3 passou da conta." defaultValue="3" />);
    const select = screen.getByRole("combobox", { name: "Vigor" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("O valor 3 passou da conta.");
  });

  it("desativado", () => {
    render(<Select label="Lutar" options={OPTIONS} disabled />);
    expect(screen.getByRole("combobox", { name: "Lutar" })).toBeDisabled();
  });
});
