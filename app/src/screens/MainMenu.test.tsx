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
    expect(await screen.findByRole("heading", { name: "Jornada: O Selo de Elmora" })).toHaveFocus();
    expect(api.calls.some((c) => c.method === "POST" && c.path === `/journeys/${summary().id}/open`)).toBe(true);
    // Barra de status: local, personagem e período.
    const status = document.querySelector(".status-bar")!;
    expect(status).toHaveTextContent(`Local: ${WORLD.places[0]!.name}`);
    expect(status).toHaveTextContent("Personagem: Ilsa Corvalho");
    expect(status).toHaveTextContent("Noite");
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
    await screen.findByRole("tab", { name: "Chat" });
    return { user, ...game };
  }

  it("Chat traz o aviso de que o Narrador ainda não recebe a Jornada", async () => {
    await openJourney();
    expect(screen.getByText(/O Narrador ainda não recebe o contexto da sua Jornada/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem para o Narrador")).toBeInTheDocument();
  });

  it("Ficha: identidade, Atributos, Perícias, trilhas e Convicções", async () => {
    const { user } = await openJourney();
    await user.click(screen.getByRole("tab", { name: "Ficha" }));
    const panel = screen.getByRole("tabpanel", { name: "Ficha" });
    expect(within(panel).getByRole("heading", { name: "Ficha de Ilsa Corvalho" })).toBeInTheDocument();
    expect(within(panel).getByText("Mercenária endividada que busca redenção")).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Físico" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Espiritual" })).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: "Vida: 6 espaços; 0 superficiais, 0 agravados, 6 vazios" })).toBeInTheDocument();
    expect(within(panel).getByRole("img", { name: /^Vontade: 6 espaços/ })).toBeInTheDocument();
    expect(within(panel).getByText("Nunca abandonar quem luta ao meu lado")).toBeInTheDocument();
    expect(within(panel).getByText("Pilar: Bram, meu antigo sargento")).toBeInTheDocument();
    expect(within(panel).getByText(/Perícias em 0/)).toBeInTheDocument();
  });

  it("Mundo: calendário, religiões e lugares, com o local marcado", async () => {
    const { user } = await openJourney();
    await user.click(screen.getByRole("tab", { name: "Mundo" }));
    const panel = screen.getByRole("tabpanel", { name: "Mundo" });
    expect(within(panel).getByRole("heading", { name: WORLD.name })).toBeInTheDocument();
    expect(within(panel).getByText(WORLD.calendar.months[0]!.name)).toBeInTheDocument();
    expect(within(panel).getByText(WORLD.religions[0]!.name)).toBeInTheDocument();
    expect(within(panel).getByText("Você está aqui")).toBeInTheDocument();
  });

  it("Objetivos: Ambição e Desejo ativos com a explicação", async () => {
    const { user } = await openJourney();
    await user.click(screen.getByRole("tab", { name: "Objetivos" }));
    const panel = screen.getByRole("tabpanel", { name: "Objetivos" });
    expect(within(panel).getByText("Vingar o irmão morto na Ponte Velha")).toBeInTheDocument();
    expect(within(panel).getByText("Concluir o contrato de escolta atual")).toBeInTheDocument();
    expect(within(panel).getByText(/longo prazo/)).toBeInTheDocument();
    expect(within(panel).getByText(/curto prazo/)).toBeInTheDocument();
  });

  it("Menu fecha a Jornada e volta ao menu", async () => {
    const { user, api } = await openJourney();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Henduran" })).toHaveFocus();
    expect(api.calls.some((c) => c.method === "POST" && c.path === "/journeys/close")).toBe(true);
    expect(await screen.findByText("O Selo de Elmora")).toBeInTheDocument();
  });
});
