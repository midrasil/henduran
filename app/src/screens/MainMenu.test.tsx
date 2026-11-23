import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { INFO, stubGame } from "../test/appHarness";
import { summary } from "../test/fakeGameApi";
import { WORLD } from "../test/gameData";

const { getBackendInfo, canExitApp, exitApp } = vi.hoisted(() => ({
  getBackendInfo: vi.fn(),
  canExitApp: vi.fn(() => false),
  exitApp: vi.fn(async () => undefined),
}));

vi.mock("../api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/backend")>();
  return { ...actual, getBackendInfo, canExitApp, exitApp };
});

// A tela da Jornada inteira no jsdom é lenta em máquinas carregadas.
vi.setConfig({ testTimeout: 20000 });

beforeEach(() => {
  getBackendInfo.mockReset();
  getBackendInfo.mockResolvedValue(INFO);
  canExitApp.mockReset();
  canExitApp.mockReturnValue(false);
  exitApp.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderMenu() {
  render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
  await screen.findByText("Conectado");
}

const sky = () => document.querySelector(".app__sky");

describe("Menu inicial", () => {
  it("abre no menu, sem Jornadas: convida a criar e Continuar fica desativado", async () => {
    stubGame();
    await renderMenu();
    expect(screen.getByRole("heading", { level: 1, name: "Henduran" })).toBeInTheDocument();
    expect(screen.getByText("Jornada solo de fantasia com Narrador IA")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Comece a sua primeira Jornada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar Jornada" })).toBeDisabled();
    for (const name of ["Nova Jornada", "Jornadas", "Modelos"]) expect(screen.getByRole("button", { name })).toBeEnabled();
    // Sem Jornada, o céu do período padrão.
    expect(sky()).toHaveAttribute("data-period", "entardecer");
    expect(screen.getByText(/RPG solo guiado por IA/)).toHaveTextContent(/v\d+\.\d+\.\d+/);
    // Fora do Tauri, não há Sair.
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("mostra a última Jornada, com o céu do período dela, e Continuar abre a Jornada", async () => {
    const { api } = stubGame({ journeys: [summary()], lastJourneyId: summary().id });
    const user = userEvent.setup();
    await renderMenu();
    await screen.findByText("O Selo de Elmora");
    const card = screen.getByRole("region", { name: "Última Jornada" });
    expect(within(card).getByText(/Ilsa Corvalho/)).toBeInTheDocument();
    expect(within(card).getByText(new RegExp(`${WORLD.places[0]!.name}, ${WORLD.name}`))).toBeInTheDocument();
    expect(within(card).getByText(/Salvo em:/)).toHaveTextContent(/Salvo em: .*\d{2}:\d{2}/);
    expect(within(card).getByText("Noite")).toBeInTheDocument();
    await waitFor(() => expect(sky()).toHaveAttribute("data-period", "noite"));

    await user.click(screen.getByRole("button", { name: "Continuar Jornada" }));
    expect(await screen.findByRole("heading", { level: 1, name: "O Selo de Elmora" })).toHaveFocus();
    expect(api.calls.some((c) => c.method === "POST" && c.path === `/journeys/${summary().id}/open`)).toBe(true);
    // Barra da Jornada: personagem, Mundo e período (sem a barra de status).
    const bar = document.querySelector(".jbar")!;
    expect(bar).toHaveTextContent(`Ilsa Corvalho · ${WORLD.name}`);
    expect(bar).toHaveTextContent("Noite");
  });

  it("Jornada danificada: aviso no cartão e Continuar desativado", async () => {
    stubGame({
      journeys: [summary({ status: "danificada", error_code: "banco_danificado", error_message: "x" })],
      lastJourneyId: summary().id,
    });
    await renderMenu();
    await screen.findByText(/está danificado/);
    const card = screen.getByRole("region", { name: "Última Jornada" });
    expect(screen.getByRole("button", { name: "Continuar Jornada" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Ver Jornadas" })).toBeInTheDocument();
  });

  it("erro ao continuar aparece com mensagem clara e leva às Jornadas", async () => {
    stubGame({
      journeys: [summary()],
      lastJourneyId: summary().id,
      openError: { status: 409, code: "jornada_bloqueada", message: "bloqueada" },
    });
    const user = userEvent.setup();
    await renderMenu();
    const button = await screen.findByRole("button", { name: "Continuar Jornada" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Esta Jornada está aberta em outra janela do Henduran.");
    await user.click(within(alert).getByRole("button", { name: "Ver Jornadas" }));
    expect(await screen.findByRole("heading", { name: "Jornadas" })).toHaveFocus();
  });

  it("Sair chama o encerramento do app (só dentro do Tauri)", async () => {
    canExitApp.mockReturnValue(true);
    stubGame();
    const user = userEvent.setup();
    await renderMenu();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(exitApp).toHaveBeenCalledTimes(1);
  });
});

describe("Jornada aberta", () => {
  async function openJourney() {
    const game = stubGame({ journeys: [summary()], lastJourneyId: summary().id });
    const user = userEvent.setup();
    await renderMenu();
    const button = await screen.findByRole("button", { name: "Continuar Jornada" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await screen.findByRole("log", { name: "Conversa da Cena" });
    return { user, ...game };
  }

  it("Ficha resumida: retrato com iniciais, trilhas, Atributos e Perícias treinadas (sem Objetivos nem Convicções)", async () => {
    const { user } = await openJourney();
    const sheet = screen.getByRole("complementary", { name: "Ficha resumida" });
    expect(within(sheet).getByText("Mercenária endividada que busca redenção")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Trocar o retrato de Ilsa Corvalho" })).toHaveTextContent("IC");
    expect(within(sheet).getByRole("img", { name: "Vida: 0 agravados, 0 superficiais, 6 livres de 6" })).toBeInTheDocument();
    expect(within(sheet).getByRole("img", { name: /^Vontade: 0 agravados/ })).toBeInTheDocument();
    expect(within(sheet).getByText("Lutar")).toBeInTheDocument();
    expect(within(sheet).queryByText("Erudição")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Nunca abandonar quem luta ao meu lado")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Vingar o irmão morto na Ponte Velha")).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Mostrar as 22 Perícias" }));
    expect(within(sheet).getByText("Erudição")).toBeInTheDocument();
  });

  it("Ficha completa: abas laterais com Objetivos, Convicções e Descrição", async () => {
    const { user } = await openJourney();
    await user.click(screen.getByRole("button", { name: "Abrir a ficha completa" }));
    const dialog = await screen.findByRole("dialog", { name: "Ficha completa" });
    const tabs = within(dialog).getByRole("tablist", { name: "Seções da ficha" });
    expect(tabs).toHaveAttribute("aria-orientation", "vertical");
    await user.click(within(dialog).getByRole("tab", { name: "Objetivos" }));
    expect(within(dialog).getByText("Vingar o irmão morto na Ponte Velha")).toBeInTheDocument();
    expect(within(dialog).getByText("Concluir o contrato de escolta atual")).toBeInTheDocument();
    expect(within(dialog).getByText(/Arco 1 · 1 Cena/)).toBeInTheDocument();
    // Setas para cima e para baixo trocam de aba.
    within(dialog).getByRole("tab", { name: "Objetivos" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(within(dialog).getByRole("tab", { name: "Convicções" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByText("Nunca abandonar quem luta ao meu lado")).toBeInTheDocument();
    expect(within(dialog).getByText(/Pilar: Bram, meu antigo sargento · íntegra/)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("img", { name: "0 de 2 Fraturas" })).toHaveLength(3);
    await user.click(within(dialog).getByRole("tab", { name: "Descrição" }));
    expect(within(dialog).getByText("Alta, cabelo raspado, cicatriz no queixo.")).toBeInTheDocument();
    expect(within(dialog).getAllByText("não informado").length).toBeGreaterThan(0);
  });

  it("⚙ Mundo: lugares do registro, o atual marcado e o caminho", async () => {
    const { user } = await openJourney();
    await user.click(screen.getByRole("button", { name: "Opções" }));
    await user.click(screen.getByRole("menuitem", { name: /Mundo/ }));
    const dialog = await screen.findByRole("dialog", { name: `Mundo · ${WORLD.name}` });
    expect(await within(dialog).findByText("Você está aqui")).toBeInTheDocument();
    expect(within(dialog).getAllByText(WORLD.places[1]!.name).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(`Por onde Ilsa Corvalho passou`)).toBeInTheDocument();
  });

  it("⚙ Voltar ao menu fecha a Jornada e volta ao menu", async () => {
    const { user, api } = await openJourney();
    await user.click(screen.getByRole("button", { name: "Opções" }));
    await user.click(screen.getByRole("menuitem", { name: /Voltar ao menu/ }));
    const dialog = await screen.findByRole("dialog", { name: "Voltar ao menu?" });
    await user.click(within(dialog).getByRole("button", { name: "Voltar ao menu" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Henduran" })).toHaveFocus();
    expect(api.calls.some((c) => c.method === "POST" && c.path === "/journeys/close")).toBe(true);
    expect(await screen.findByText("O Selo de Elmora")).toBeInTheDocument();
  });
});
