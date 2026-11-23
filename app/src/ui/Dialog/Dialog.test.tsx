import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

function Harness({ onConfirm = () => undefined }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Remover</Button>
      <Button>Outro</Button>
      <Dialog
        open={open}
        tone="danger"
        title="Apagar modelo.gguf do disco?"
        description={<p>Isto não pode ser desfeito.</p>}
        onClose={() => setOpen(false)}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button ref={cancelRef} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Apagar do disco
            </Button>
          </>
        }
      />
    </>
  );
}

describe("Dialog", () => {
  it("abre modal, rotulado e descrito, com foco no elemento inicial", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = screen.getByRole("dialog", { name: "Apagar modelo.gguf do disco?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Isto não pode ser desfeito.");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("prende o foco com Tab e Shift+Tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = screen.getByRole("dialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
    const confirm = within(dialog).getByRole("button", { name: "Apagar do disco" });
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("Esc fecha e devolve o foco a quem abriu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Remover" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("deixa o resto da página inerte enquanto aberto", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(container.inert).toBe(true);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(container.inert).toBe(false);
  });

  it("confirma pela ação", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await user.click(screen.getByRole("button", { name: "Apagar do disco" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("não fecha com Esc quando não pode ser dispensado", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Dialog open title="Aguarde" onClose={onClose} dismissible={false} actions={<Button>Ok</Button>} />);
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Aguarde" })).toBeInTheDocument();
  });
});
