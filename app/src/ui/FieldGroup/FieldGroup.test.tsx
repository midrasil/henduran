import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldGroup } from "./FieldGroup";

describe("FieldGroup", () => {
  it("fieldset rotulado pela legenda, com dica e erro na descrição", () => {
    render(
      <FieldGroup legend="Atributos" hint="Distribua os valores." error="A distribuição está errada." legendId="g-attrs">
        <input aria-label="Força" />
      </FieldGroup>,
    );
    const group = screen.getByRole("group", { name: "Atributos" });
    expect(group).toHaveAccessibleDescription("Distribua os valores. A distribuição está errada.");
    const legend = document.getElementById("g-attrs")!;
    legend.focus();
    expect(legend).toHaveFocus();
  });
});
