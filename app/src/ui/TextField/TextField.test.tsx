import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "../Button/Button";
import { TextArea, TextField } from "./TextField";

describe("TextField", () => {
  it("rótulo, dica e digitação", async () => {
    const user = userEvent.setup();
    render(<TextField label="Nome do modelo" hint="Só repositórios públicos." />);
    const input = screen.getByRole("textbox", { name: "Nome do modelo" });
    expect(input).toHaveAccessibleDescription("Só repositórios públicos.");
    expect(input).not.toHaveAttribute("aria-invalid");
    await user.type(input, "Qwen");
    expect(input).toHaveValue("Qwen");
  });

  it("erro marca inválido e entra na descrição", () => {
    render(<TextField label="Caminho" hint="Pasta completa." error="A pasta não existe." />);
    const input = screen.getByRole("textbox", { name: "Caminho" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Pasta completa. A pasta não existe.");
  });

  it("rótulo oculto continua acessível e a ação fica ao lado", () => {
    render(<TextField label="Busca" hideLabel action={<Button>Buscar</Button>} />);
    expect(screen.getByRole("textbox", { name: "Busca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
  });

  it("desativado", () => {
    render(<TextField label="X" disabled />);
    expect(screen.getByRole("textbox", { name: "X" })).toBeDisabled();
  });
});

describe("TextArea", () => {
  it("rótulo, dica, ref e várias linhas", async () => {
    const user = userEvent.setup();
    let el: HTMLTextAreaElement | null = null;
    render(
      <TextArea
        label="Mensagem para o Narrador"
        hint="Enter envia."
        ref={(node) => {
          el = node;
        }}
      />,
    );
    const area = screen.getByRole("textbox", { name: "Mensagem para o Narrador" });
    expect(el).toBe(area);
    expect(area).toHaveAccessibleDescription("Enter envia.");
    await user.type(area, "linha 1{Shift>}{Enter}{/Shift}linha 2");
    expect(area).toHaveValue("linha 1\nlinha 2");
  });

  it("erro", () => {
    render(<TextArea label="Notas" error="Obrigatório." />);
    expect(screen.getByRole("textbox", { name: "Notas" })).toHaveAccessibleDescription("Obrigatório.");
  });
});
