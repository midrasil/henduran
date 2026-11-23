import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PixelIcon } from "../icons";
import { Badge } from "./Badge";

describe("Badge", () => {
  it.each(["neutral", "accent", "success", "warn", "danger", "info"] as const)("tom %s com texto", (tone) => {
    render(<Badge tone={tone}>Estado {tone}</Badge>);
    expect(screen.getByText(`Estado ${tone}`)).toHaveClass(`badge--${tone}`);
  });

  it("ícone é decorativo", () => {
    render(<Badge icon={<PixelIcon name="check" />}>Ativo</Badge>);
    const badge = screen.getByText("Ativo");
    expect(badge.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(badge).toHaveTextContent(/^Ativo$/);
  });
});
