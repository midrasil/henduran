import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Composer, growTextArea } from "./Composer";

function Harness({ onSubmit, streaming = false, disabled = false, onStop }: { onSubmit: (text: string) => void; streaming?: boolean; disabled?: boolean; onStop?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <Composer
      id="c"
      label="Mensagem"
      value={value}
      onChange={setValue}
      onSubmit={() => {
        onSubmit(value);
        setValue("");
      }}
      streaming={streaming}
      disabled={disabled}
      {...(onStop ? { onStop } : {})}
    />
  );
}

describe("Composer", () => {
  it("começa com uma linha; Enter envia e Shift+Enter pula linha", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    expect(input).toHaveAttribute("rows", "1");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();

    await user.type(input, "linha 1{Shift>}{Enter}{/Shift}linha 2");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue("linha 1\nlinha 2");

    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("linha 1\nlinha 2");
    expect(input).toHaveValue("");
  });

  it("não envia vazio nem só espaços", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox"), "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("durante a resposta o ícone vira Parar", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<Harness onSubmit={vi.fn()} streaming onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Parar" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("desabilitado: sem digitação nem envio", () => {
    render(<Harness onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("cresce com o texto até o limite e depois rola", () => {
    const el = document.createElement("textarea");
    let scroll = 60;
    Object.defineProperty(el, "scrollHeight", { get: () => scroll });
    expect(growTextArea(el, 190)).toBe(60);
    expect(el.style.height).toBe("60px");
    expect(el.style.overflowY).toBe("hidden");
    scroll = 400;
    expect(growTextArea(el, 190)).toBe(190);
    expect(el.style.height).toBe("190px");
    expect(el.style.overflowY).toBe("auto");
  });
});
