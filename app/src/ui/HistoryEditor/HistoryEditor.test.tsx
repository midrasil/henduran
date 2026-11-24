import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { plainTextOfHtml, wordCount } from "../../screens/newJourney/model";
import { HistoryEditor } from "./HistoryEditor";

function Harness({ initial = "", onChange }: { initial?: string; onChange?: (html: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <HistoryEditor
        id="h"
        label="História do personagem"
        value={value}
        onChange={(html) => {
          setValue(html);
          onChange?.(html);
        }}
        limit={20}
        plainText={plainTextOfHtml}
        countWords={wordCount}
        placeholder="Conte a história…"
        toolbarExtra={<button type="button">Extra</button>}
      />
      <button type="button" onClick={() => setValue("<p>de fora</p>")}>
        Trocar
      </button>
    </>
  );
}

describe("HistoryEditor (provisório)", () => {
  it("mostra a barra, o valor inicial e o contador do texto puro", () => {
    render(<Harness initial="<h3>Origens</h3><p>Cresceu no porto.</p>" />);
    const area = screen.getByRole("textbox", { name: "História do personagem" });
    expect(area).toHaveAttribute("contenteditable", "true");
    expect(area).toHaveAttribute("aria-multiline", "true");
    expect(area.innerHTML).toBe("<h3>Origens</h3><p>Cresceu no porto.</p>");
    expect(screen.getByRole("toolbar", { name: "Formatação do texto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Negrito (Ctrl+B)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Extra" })).toBeInTheDocument();
    // "Origens\nCresceu no porto." = 25 caracteres, acima do limite 20: o contador avisa.
    const count = screen.getByText(/4 palavras · 25\/20 caracteres/);
    expect(count).toHaveClass("rte__count--over");
    expect(area).toHaveAccessibleDescription(/4 palavras · 25\/20 caracteres/);
  });

  it("emite o HTML ao editar e aceita valor novo vindo de fora", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const area = screen.getByRole("textbox", { name: "História do personagem" });
    area.innerHTML = "<p>Oi <b>mundo</b></p>";
    fireEvent.input(area);
    expect(onChange).toHaveBeenLastCalledWith("<p>Oi <b>mundo</b></p>");
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    expect(area.innerHTML).toBe("<p>de fora</p>");
  });

  it("sem texto, o valor fica vazio (o placeholder aparece)", () => {
    const onChange = vi.fn();
    render(<Harness initial="<p>x</p>" onChange={onChange} />);
    const area = screen.getByRole("textbox", { name: "História do personagem" });
    area.innerHTML = "<p><br></p>";
    fireEvent.input(area);
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(area.innerHTML).toBe("");
    expect(area).toHaveAttribute("data-placeholder", "Conte a história…");
  });

  it("colar insere só o texto, nunca o HTML de fora", () => {
    const onChange = vi.fn();
    render(<Harness initial="<p>a</p>" onChange={onChange} />);
    const area = screen.getByRole("textbox", { name: "História do personagem" });
    const range = document.createRange();
    range.selectNodeContents(area.querySelector("p")!);
    range.collapse(false);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.paste(area, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? " b <img src=x onerror=alert(1)>" : '<img src=x onerror="alert(1)">'),
      },
    });
    expect(area.querySelector("img")).toBeNull();
    expect(area.textContent).toBe("a b <img src=x onerror=alert(1)>");
    expect(onChange).toHaveBeenLastCalledWith(area.innerHTML);
  });

  it("desabilitado não edita", () => {
    render(
      <HistoryEditor id="h" label="História" value="" onChange={() => undefined} limit={10} plainText={plainTextOfHtml} countWords={wordCount} disabled />,
    );
    expect(screen.getByRole("textbox", { name: "História" })).toHaveAttribute("contenteditable", "false");
    expect(screen.getByRole("button", { name: "Negrito (Ctrl+B)" })).toBeDisabled();
  });
});
