import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("é um botão do tipo button por padrão e responde a clique e teclado", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Enviar</Button>);
    const button = screen.getByRole("button", { name: "Enviar" });
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it.each(["primary", "secondary", "danger", "ghost"] as const)("variante %s tem classe própria", (variant) => {
    render(<Button variant={variant}>Ação</Button>);
    expect(screen.getByRole("button", { name: "Ação" })).toHaveClass(`btn--${variant}`);
  });

  it("desativado não dispara clique", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("carregando: desativado, aria-busy e o rótulo continua o nome acessível", () => {
    render(
      <Button variant="primary" loading>
        Buscar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Buscar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("repassa ref e atributos", () => {
    let el: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(node) => {
          el = node;
        }}
        type="submit"
        aria-describedby="x"
      >
        Ok
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Ok" });
    expect(el).toBe(button);
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-describedby", "x");
  });
});
