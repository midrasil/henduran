import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INFO, stubGame } from "../test/appHarness";
import { savedWorld, WORLD_ID } from "../test/fakeGameApi";
import { WORLD, WORLD_SCHEMA } from "../test/gameData";
import { WorldsScreen } from "./WorldsScreen";

vi.setConfig({ testTimeout: 20000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

const FREE_ID = "55555555-5555-4555-8555-555555555555";

function setup(worlds = [savedWorld(), savedWorld({ id: FREE_ID, name: "Costa Livre", journey_count: 0, seed: null })]) {
  const game = stubGame({ savedWorlds: worlds });
  const user = userEvent.setup();
  render(<WorldsScreen info={INFO} schema={WORLD_SCHEMA} makeSeed={() => 42} validationDelayMs={0} />);
  return { ...game, user };
}

const option = (name: RegExp) => screen.getByRole("option", { name });

describe("Tela de Mundos (modelo provisório)", () => {
  it("lista os Mundos salvos com semente ou Mundo personalizado e o uso; o detalhe é só leitura", async () => {
    const { user } = setup();
    expect(await screen.findByRole("option", { name: new RegExp(WORLD.name) })).toHaveTextContent(/semente \d+ · Usado em 1 Jornada/);
    expect(option(/Costa Livre/)).toHaveTextContent("Mundo personalizado · Ainda sem Jornadas");
    await user.click(option(new RegExp(WORLD.name)));
    const name = await screen.findByRole("textbox", { name: "Nome do Mundo" });
    expect(name).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Duplicar e editar" })).toBeInTheDocument();
    // Sem lugar inicial nesta tela.
    expect(screen.queryByText(/Começa em/)).not.toBeInTheDocument();
  });

  it("Gerar mundo e Salvar Mundo: grava com a semente e o Mundo entra na lista", async () => {
    const { user, api } = setup([]);
    expect(await screen.findByText(/Você ainda não tem Mundos salvos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar mundo" }));
    expect(await screen.findByRole("option", { name: /Novo · ainda não salvo/ })).toBeInTheDocument();
    expect(screen.getByText(/Gerado com a semente 42/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar Mundo" }));
    expect(await screen.findByText(`Mundo “${WORLD.name} 42” salvo.`)).toBeInTheDocument();
    const posted = api.calls.find((c) => c.method === "POST" && c.path === "/worlds");
    expect((posted?.body as { seed?: number }).seed).toBe(42);
    expect(await screen.findByRole("option", { name: new RegExp(`${WORLD.name} 42`) })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("option", { name: /Novo · ainda não salvo/ })).not.toBeInTheDocument();
  });

  it("Criar do zero: Salvar mostra os erros e não grava; Mundo editado vira personalizado", async () => {
    const { user, api } = setup([]);
    await user.click(await screen.findByRole("button", { name: "Criar do zero" }));
    expect(screen.getByText("Mundo personalizado (sem semente).", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar Mundo" }));
    expect(await screen.findByText(/O nome do Mundo é obrigatório/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === "POST" && c.path === "/worlds")).toBe(false);
  });

  it("Excluir pede confirmação e apaga um Mundo sem Jornadas", async () => {
    const { user, api } = setup();
    await user.click(await screen.findByRole("option", { name: /Costa Livre/ }));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("dialog", { name: "Excluir “Costa Livre”?" });
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Excluir do disco" }));
    expect(await screen.findByText("Mundo “Costa Livre” excluído.")).toBeInTheDocument();
    expect(api.calls).toContainEqual({ method: "DELETE", path: `/worlds/${FREE_ID}?confirm=true`, body: undefined });
    await waitFor(() => expect(screen.queryByRole("option", { name: /Costa Livre/ })).not.toBeInTheDocument());
  });

  it("Mundo em uso: o diálogo explica e não deixa excluir", async () => {
    const { user, api } = setup();
    await user.click(await screen.findByRole("option", { name: new RegExp(WORLD.name) }));
    await user.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("usado em 1 Jornada e não pode ser excluído");
    expect(within(dialog).getByRole("button", { name: "Excluir do disco" })).toBeDisabled();
    expect(api.calls.some((c) => c.method === "DELETE" && c.path.startsWith(`/worlds/${WORLD_ID}`))).toBe(false);
  });
});
