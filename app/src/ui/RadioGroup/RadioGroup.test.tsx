import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { RadioGroup } from "./RadioGroup";

const OPTIONS = [
  { value: "generalista", label: "Generalista", description: "1 em 3, 6 em 2 e 6 em 1" },
  { value: "equilibrado", label: "Equilibrado", description: "2 em 3, 4 em 2 e 6 em 1" },
  { value: "especialista", label: "Especialista" },
];

function Demo({ error }: { error?: string }) {
  const [value, setValue] = useState<string | null>(null);
  return <RadioGroup legend="Perfil" hint="Escolha um." options={OPTIONS} value={value} onChange={setValue} {...(error ? { error } : {})} />;
}

describe("RadioGroup", () => {
  it("grupo rotulado, nome da opção sem a descrição e descrição ligada", () => {
    render(<Demo />);
    const group = screen.getByRole("group", { name: "Perfil" });
    expect(group).toHaveAccessibleDescription("Escolha um.");
    const radio = screen.getByRole("radio", { name: "Generalista" });
    expect(radio).toHaveAccessibleDescription("1 em 3, 6 em 2 e 6 em 1");
    expect(radio).not.toBeChecked();
  });

  it("clique e setas marcam", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("radio", { name: "Generalista" }));
    expect(screen.getByRole("radio", { name: "Generalista" })).toBeChecked();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Equilibrado" })).toBeChecked();
  });

  it("erro na descrição do grupo", () => {
    render(<Demo error="Escolha um perfil de Perícias." />);
    expect(screen.getByRole("group", { name: "Perfil" })).toHaveAccessibleDescription("Escolha um. Escolha um perfil de Perícias.");
  });
});
