import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { ListCard } from "./ListCard";

describe("ListCard", () => {
  it("mostra título, detalhes, etiquetas, conteúdo e ações dentro de um item de lista", async () => {
    const onUse = vi.fn();
    const user = userEvent.setup();
    render(
      <ul aria-label="Modelos">
        <ListCard
          title="Pequeno.gguf"
          titleId="t1"
          meta="400 MB · Q4_K_M"
          tags={<Badge tone="success">Cabe na sua placa</Badge>}
          actions={
            <Button variant="primary" aria-describedby="t1" onClick={onUse}>
              Usar este modelo
            </Button>
          }
        >
          <p>Pronto</p>
        </ListCard>
      </ul>,
    );
    const item = within(screen.getByRole("list", { name: "Modelos" })).getByRole("listitem");
    expect(item).toHaveTextContent("Pequeno.gguf");
    expect(item).toHaveTextContent("400 MB · Q4_K_M");
    expect(item).toHaveTextContent("Cabe na sua placa");
    expect(item).toHaveTextContent("Pronto");
    const button = within(item).getByRole("button", { name: "Usar este modelo" });
    expect(button).toHaveAccessibleDescription("Pequeno.gguf");
    await user.click(button);
    expect(onUse).toHaveBeenCalled();
  });

  it("selecionado muda só o visual", () => {
    render(<ListCard as="div" title="Ativo" selected />);
    expect(screen.getByText("Ativo").closest(".list-card")).toHaveClass("list-card--selected");
  });
});
