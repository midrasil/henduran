import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatBubble } from "./ChatBubble";

describe("ChatBubble", () => {
  it("narrador em pergaminho, com quem fala e o texto", () => {
    render(
      <ChatBubble variant="narrator" speaker="Narrador">
        Você entra na oficina do ferreiro.
      </ChatBubble>,
    );
    const text = screen.getByText("Você entra na oficina do ferreiro.");
    const bubble = text.closest(".bubble");
    expect(bubble).toHaveClass("bubble--narrator", "surface-parchment");
    expect(bubble).toHaveTextContent(/^NarradorVocê entra/);
  });

  it.each(["player", "system", "aside"] as const)("variante %s", (variant) => {
    render(<ChatBubble variant={variant}>texto {variant}</ChatBubble>);
    expect(screen.getByText(`texto ${variant}`).closest(".bubble")).toHaveClass(`bubble--${variant}`);
  });

  it("cursor de streaming é decorativo e notas aparecem", () => {
    render(
      <ChatBubble variant="narrator" speaker="Narrador" streaming notes={<p>Resposta interrompida.</p>}>
        Era uma vez
      </ChatBubble>,
    );
    expect(screen.getByText("Era uma vez")).toBeInTheDocument();
    expect(screen.getByText("Resposta interrompida.")).toBeInTheDocument();
    expect(document.querySelector(".bubble__caret")).toHaveAttribute("aria-hidden", "true");
  });
});
