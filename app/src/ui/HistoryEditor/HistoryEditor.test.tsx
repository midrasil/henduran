import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { plainTextOfHtml, wordCount } from "../../screens/newJourney/model";
import { HistoryEditor } from "./HistoryEditor";

/*
 * O jsdom não tem layout nem seleção de verdade: aqui se testa o que o TipTap faz sem eles
 * (documento inicial, valor vindo de fora, comandos da barra, saída e esquema). Digitar, colar
 * com a área de transferência real e o estado da barra ao mover o cursor só um navegador valida.
 */

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
      <output data-testid="value">{value}</output>
    </>
  );
}

const area = () => screen.getByRole("textbox", { name: "História do personagem" });

describe("HistoryEditor (TipTap)", () => {
  it("mostra a barra, o valor inicial e o contador do texto puro", () => {
    render(<Harness initial="<h3>Origens</h3><p>Cresceu no porto.</p>" />);
    expect(area()).toHaveAttribute("contenteditable", "true");
    expect(area()).toHaveAttribute("aria-multiline", "true");
    expect(area().querySelector("h3")?.textContent).toBe("Origens");
    expect(area().querySelector("p")?.textContent).toBe("Cresceu no porto.");
    const bar = screen.getByRole("toolbar", { name: "Formatação do texto" });
    expect(bar).toHaveAttribute("aria-controls", "h");
    expect(screen.getByRole("button", { name: "Negrito (Ctrl+B)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Citação" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Limpar formatação" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Extra" })).toBeInTheDocument();
    // "Origens\nCresceu no porto." = 25 caracteres, acima do limite 20: o contador avisa.
    const count = screen.getByText(/4 palavras · 25\/20 caracteres/);
    expect(count).toHaveClass("rte__count--over");
    expect(area()).toHaveAccessibleDescription(/4 palavras · 25\/20 caracteres/);
  });

  it("aceita valor novo vindo de fora sem emitir mudança", async () => {
    const onChange = vi.fn();
    render(<Harness initial="<p>x</p>" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
    await waitFor(() => expect(area().textContent).toBe("de fora"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("os comandos da barra formatam e emitem o HTML", async () => {
    const onChange = vi.fn();
    render(<Harness initial="<p>texto</p>" onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lista com marcadores" }));
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<ul><li><p>texto</p></li></ul>"));
    expect(screen.getByRole("button", { name: "Lista com marcadores" })).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desfazer (Ctrl+Z)" }));
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<p>texto</p>"));
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: "Estilo do parágrafo" }), { target: { value: "h2" } });
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<h2>texto</h2>"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Centralizar" }));
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<h2 style="text-align: center;">texto</h2>'));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Limpar formatação" }));
    });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("<p>texto</p>"));
  });

  it("o esquema só aceita o conjunto do ADR-077 (links, imagens, código e scripts somem)", () => {
    render(
      <Harness initial={'<p>a <a href="http://x">link</a> <code>c</code> <img src=x onerror="alert(1)"><script>alert(2)</script></p><pre>bloco</pre><hr>'} />,
    );
    const html = area().innerHTML;
    expect(html).not.toMatch(/<a |<img|<code|<pre|<hr|<script|onerror/);
    expect(area().textContent).toContain("link");
  });

  it("sem texto, o placeholder aparece no documento vazio", () => {
    render(<Harness />);
    const p = area().querySelector("p");
    expect(p).toHaveAttribute("data-placeholder", "Conte a história…");
    expect(p).toHaveClass("is-editor-empty");
  });

  it("desabilitado não edita", () => {
    render(
      <HistoryEditor id="h" label="História" value="" onChange={() => undefined} limit={10} plainText={plainTextOfHtml} countWords={wordCount} disabled error="Escreva a história." />,
    );
    const field = screen.getByRole("textbox", { name: "História" });
    expect(field).toHaveAttribute("contenteditable", "false");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(/Escreva a história\./);
    expect(screen.getByRole("button", { name: "Negrito (Ctrl+B)" })).toBeDisabled();
  });
});
