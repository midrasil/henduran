import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TabPanel, Tabs } from "./Tabs";

type Id = "a" | "b" | "c";

function Harness() {
  const [value, setValue] = useState<Id>("a");
  const items = [
    { id: "a" as const, label: "Jornada" },
    { id: "b" as const, label: "Ficha" },
    { id: "c" as const, label: "Mundo" },
  ];
  return (
    <>
      <Tabs items={items} value={value} onChange={setValue} label="Seções" idPrefix="t" />
      {items.map((t) => (
        <TabPanel key={t.id} idPrefix="t" id={t.id} selected={value === t.id}>
          Conteúdo {t.label}
        </TabPanel>
      ))}
    </>
  );
}

describe("Tabs", () => {
  it("segue o padrão WAI-ARIA: tablist, aria-selected, aria-controls e painel rotulado", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Seções" })).toBeInTheDocument();
    const first = screen.getByRole("tab", { name: "Jornada" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Ficha" })).toHaveAttribute("tabindex", "-1");
    const panel = screen.getByRole("tabpanel", { name: "Jornada" });
    expect(first).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveTextContent("Conteúdo Jornada");
  });

  it("setas, Home e End movem o foco e selecionam", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Jornada" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Ficha" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Ficha" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Ficha" })).toBeVisible();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Mundo" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Jornada" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Mundo" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Jornada" })).toHaveAttribute("aria-selected", "true");
  });

  it("clique seleciona e só a aba ativa entra na tabulação", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Mundo" }));
    expect(screen.getByRole("tab", { name: "Mundo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tabpanel", { name: "Jornada" })).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("tab", { name: "Mundo" })).not.toHaveFocus();
  });
});
