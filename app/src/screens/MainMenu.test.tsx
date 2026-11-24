import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EngineStatus } from "../api/engine";
import { App } from "../App";
import { ENGINE_IDLE, INFO, stubGame } from "../test/appHarness";
import { summary } from "../test/fakeGameApi";
import { CALENDAR } from "../test/fakeJourneyScreen";
import { WORLD } from "../test/gameData";
import { serviceState } from "./MainMenu";

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

const scene = () => document.querySelector(".menu-scene");
const card = () => screen.getByRole("region", { name: "Última Jornada" });
const indicator = () => screen.getByRole("button", { name: /Abrir Modelos$/ });

describe("Menu inicial", () => {
  it("primeira vez: sem cartão de Última Jornada, Continuar desativado, sem Modelos entre os botões", async () => {
    stubGame();
    await renderMenu();
    expect(screen.getByRole("heading", { level: 1, name: "Henduran" })).toBeInTheDocument();
    expect(screen.getByText("Jornada solo de fantasia com Narrador IA")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Carregando…")).not.toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Sua primeira Jornada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Última Jornada" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ainda não há nenhuma Jornada/)).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Menu inicial" });
    expect(within(nav).getByRole("button", { name: "Continuar Jornada" })).toBeDisabled();
    for (const name of ["Nova Jornada", "Jornadas"]) expect(within(nav).getByRole("button", { name })).toBeEnabled();
    // Modelos não é botão do menu: o acesso fica no indicador do rodapé.
    expect(within(nav).queryByRole("button", { name: /Modelos/ })).not.toBeInTheDocument();
    // Sem Jornada, a paisagem do período padrão.
    expect(scene()).toHaveAttribute("data-period", "entardecer");
    expect(screen.getByText(/^Henduran · v\d+\.\d+\.\d+/)).toBeInTheDocument();
    // Fora do Tauri, não há Sair.
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("cartão da última Jornada: personagem, lugar e Mundo, período e data, Cena e salvo há…; Ver todas abre Jornadas", async () => {
    const saved = new Date(Date.now() - 2 * 3600 * 1000 - 60 * 1000).toISOString();
    stubGame({
      journeys: [summary({ calendar: CALENDAR, current_scene_title: "A carta da garça", last_saved_at: saved })],
      lastJourneyId: summary().id,
    });
    const user = userEvent.setup();
    await renderMenu();
    await screen.findByText("O Selo de Elmora");
    const c = card();
    expect(within(c).getByText(/Ilsa Corvalho/)).toBeInTheDocument();
    expect(within(c).getByText(new RegExp(`${WORLD.places[0]!.name}, ${WORLD.name}`))).toBeInTheDocument();
    expect(within(c).getByText("Noite")).toBeInTheDocument();
    expect(within(c).getByText(`· 12 de ${CALENDAR.month_name}, ${CALENDAR.weekday_name} · ${CALENDAR.era_label}`)).toBeInTheDocument();
    expect(within(c).getByText("Em Cena: “A carta da garça”")).toBeInTheDocument();
    expect(within(c).getByText("Salvo há 2 horas")).toHaveAttribute("datetime", saved);
    // Sem retrato: as iniciais.
    expect(within(c).getByRole("img", { name: "Ilsa Corvalho, sem retrato" })).toHaveTextContent("IC");
    await waitFor(() => expect(scene()).toHaveAttribute("data-period", "noite"));
    await user.click(within(c).getByRole("button", { name: "Ver todas" }));
    expect(await screen.findByRole("heading", { name: "Jornadas" })).toHaveFocus();
  });

  it("Fora de Cena e sem data: o cartão não inventa nada", async () => {
    stubGame({ journeys: [summary()], lastJourneyId: summary().id });
    await renderMenu();
    await screen.findByText("O Selo de Elmora");
    expect(within(card()).queryByText(/Em Cena/)).not.toBeInTheDocument();
    expect(within(card()).getByText("Noite").parentElement).toHaveTextContent(/^Período do dia: Noite$/);
  });

  it("com retrato, o cartão busca a imagem pela rota da Jornada (sem abri-la)", async () => {
    const created = vi.fn(() => "blob:retrato");
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    try {
      const id = summary().id;
      const { fetchMock } = stubGame({
        journeys: [summary({ portrait: { crop: { x: 0.5, y: 0.4, zoom: 2 }, url_path: `/journeys/${id}/portrait` } })],
        lastJourneyId: id,
      });
      await renderMenu();
      await screen.findByText("O Selo de Elmora");
      expect(await within(card()).findByRole("img", { name: "Retrato de Ilsa Corvalho" })).toBeInTheDocument();
      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith(`/journeys/${id}/portrait`))).toBe(true);
      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith(`/journeys/${id}/open`))).toBe(false);
      expect(created).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });

  it("mostra a última Jornada com o céu do período dela, e Continuar abre a Jornada", async () => {
    const { api } = stubGame({ journeys: [summary()], lastJourneyId: summary().id });
    const user = userEvent.setup();
    await renderMenu();
    await screen.findByText("O Selo de Elmora");
    await waitFor(() => expect(scene()).toHaveAttribute("data-period", "noite"));

    await user.click(screen.getByRole("button", { name: "Continuar Jornada" }));
    expect(await screen.findByRole("heading", { level: 1, name: "O Selo de Elmora" })).toHaveFocus();
    expect(api.calls.some((c) => c.method === "POST" && c.path === `/journeys/${summary().id}/open`)).toBe(true);
    // Barra da Jornada: personagem, Mundo e período (sem a barra de status).
    const bar = document.querySelector(".jbar")!;
    expect(bar).toHaveTextContent(`Ilsa Corvalho · ${WORLD.name}`);
    expect(bar).toHaveTextContent("Noite");
  });

  it("Jornada danificada: aviso no cartão com o caminho para Jornadas e Continuar desativado", async () => {
    stubGame({
      journeys: [summary({ status: "danificada", error_code: "banco_danificado", error_message: "x" })],
      lastJourneyId: summary().id,
    });
    const user = userEvent.setup();
    await renderMenu();
    await screen.findByText(/está danificado/);
    expect(within(card()).getByRole("note")).toHaveTextContent("O arquivo desta Jornada está danificado. Restaure um backup na tela Jornadas.");
    expect(screen.getByRole("button", { name: "Continuar Jornada" })).toBeDisabled();
    await user.click(within(card()).getByRole("button", { name: "Ver todas" }));
    expect(await screen.findByRole("heading", { name: "Jornadas" })).toHaveFocus();
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

  it("indicador do rodapé: provedor pronto e abre Modelos", async () => {
    stubGame();
    const user = userEvent.setup();
    await renderMenu();
    await waitFor(() => expect(indicator()).toHaveAccessibleName("Conectado, provedor fake pronto. Abrir Modelos"));
    expect(indicator()).toHaveAttribute("data-light", "ok");
    expect(indicator()).toHaveTextContent("Modelos ▸");
    await user.click(indicator());
    expect(await screen.findByRole("heading", { name: "Modelos" })).toBeInTheDocument();
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

describe("Menu inicial — estados do serviço", () => {
  it("serviço iniciando: três primeiros botões desativados, Sair ativo, cartão e luz de espera", async () => {
    canExitApp.mockReturnValue(true);
    let release: () => void = () => undefined;
    getBackendInfo.mockReturnValue(new Promise((resolve) => (release = () => resolve(INFO))));
    stubGame();
    render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
    for (const name of ["Continuar Jornada", "Nova Jornada", "Jornadas"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
    expect(card()).toHaveTextContent("Preparando o serviço local…");
    expect(indicator()).toHaveAttribute("data-light", "busy");
    expect(screen.getByRole("status")).toHaveTextContent(/Iniciando o serviço/);
    release();
    await screen.findByText("Conectado");
  });
});

describe("serviceState", () => {
  const connected = { kind: "connected" as const, info: INFO };
  it("liga a luz pelo serviço e pelo modelo, sempre com texto", () => {
    expect(serviceState({ kind: "starting" }, null)).toEqual({ light: "busy", main: "Iniciando o serviço", detail: "aguarde" });
    expect(serviceState({ kind: "error", message: "x" }, null).light).toBe("off");
    const local = { ...ENGINE_IDLE, provider: "local" } as EngineStatus;
    expect(serviceState(connected, { ...local, state: "ready", installed: true, active_model: "m", active_model_name: "Qwen 2.5 7B" })).toEqual({
      light: "ok",
      main: "Conectado",
      detail: "Qwen 2.5 7B pronto",
    });
    expect(serviceState(connected, local)).toEqual({ light: "off", main: "Conectado", detail: "nenhum modelo carregado" });
    expect(serviceState(connected, { ...local, state: "starting", installed: true, active_model: "m" }).light).toBe("busy");
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
