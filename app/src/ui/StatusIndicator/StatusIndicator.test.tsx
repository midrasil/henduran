import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusIndicator } from "./StatusIndicator";

describe("StatusIndicator", () => {
  it("com role status, anuncia o texto", () => {
    render(<StatusIndicator tone="ok" label="Conectado" role="status" />);
    expect(screen.getByRole("status")).toHaveTextContent("Conectado");
  });

  it("sem role não é região viva", () => {
    render(<StatusIndicator tone="busy" label="Carregando" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Carregando")).toBeInTheDocument();
  });

  it("cada tom tem um ícone de forma diferente (não só cor)", () => {
    const { container } = render(
      <>
        <StatusIndicator tone="ok" label="a" />
        <StatusIndicator tone="busy" label="b" />
        <StatusIndicator tone="error" label="c" />
        <StatusIndicator tone="idle" label="d" />
      </>,
    );
    const shapes = Array.from(container.querySelectorAll("svg")).map((svg) => svg.innerHTML);
    expect(new Set(shapes).size).toBe(4);
  });
});
