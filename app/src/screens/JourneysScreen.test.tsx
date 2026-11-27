import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { INFO, stubGame } from "../test/appHarness";
import { summary, WORLD_ID } from "../test/fakeGameApi";
import type { FakeGameOptions } from "../test/fakeGameApi";

const { getBackendInfo } = vi.hoisted(() => ({ getBackendInfo: vi.fn() }));

vi.mock("../api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/backend")>();
  return { ...actual, getBackendInfo, canExitApp: () => false };
});

beforeEach(() => {
  getBackendInfo.mockReset();
  getBackendInfo.mockResolvedValue(INFO);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SECOND = summary({
  id: "44444444-4444-4444-8444-444444444444",
  name: "Crônicas do Vale",
  world_id: "55555555-5555-4555-8555-555555555555",
  last_saved_at: "2026-11-01T09:00:00+00:00",
});

async function openList(options: FakeGameOptions) {
  const game = stubGame(options);
  const user = userEvent.setup();
  render(<App backendOptions={{ attempts: 2, retryDelayMs: 1 }} />);
  await screen.findByText("Conectado");
  await user.click(screen.getByRole("button", { name: "Jornadas" }));
  expect(await screen.findByRole("heading", { name: "Jornadas" })).toHaveFocus();
  return { user, ...game };
}

const card = (name: string) => screen.getByRole("button", { name });
const detail = () => within(screen.getByRole("region", { name: "Detalhe da Jornada" }));

describe("Tela Jornadas", () => {
  it("exibe os dados do cartão e marca como Última a Jornada salva mais recentemente", async () => {
    await openList({ journeys: [summary({ last_saved_at: "2026-11-24T10:00:00Z" }), SECOND], lastJourneyId: SECOND.id });
    await screen.findByText("Crônicas do Vale");
    const first = card("O Selo de Elmora");
    expect(within(first).getByText("Última")).toBeInTheDocument();
    expect(within(first).getByText("Fora de Cena")).toBeInTheDocument();
    expect(first).not.toHaveTextContent("Ilsa Corvalho");
    expect(first).not.toHaveTextContent(/Mundo:/);
    expect(within(first).getByText(/^Salvo/)).toBeInTheDocument();
  });

  it("estado vazio", async () => {
    const { user } = await openList({});
    const empty = await screen.findByRole("heading", { name: "Nenhuma Jornada ainda" });
    const create = screen.getByRole("button", { name: "Nova Jornada" });
    expect(empty.parentElement).toContainElement(create);
    await user.click(create);
    expect(await screen.findByRole("heading", { name: "Nova Jornada" })).toBeInTheDocument();
  });

  it("Abrir leva à Jornada", async () => {
    const { user } = await openList({ journeys: [summary(), SECOND] });
    await screen.findByText("Crônicas do Vale");
    await user.click(card("Crônicas do Vale"));
    expect(card("Crônicas do Vale")).toHaveAttribute("aria-pressed", "true");
    await user.click(detail().getByRole("button", { name: "Continuar Jornada" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Crônicas do Vale" })).toBeInTheDocument();
  });

  it("busca pelo nome sem acentos e volta a mostrar todas as Jornadas ao limpar", async () => {
    const { user } = await openList({ journeys: [summary({ current_scene_title: "A chegada" }), SECOND] });
    const search = await screen.findByRole("searchbox", { name: "Buscar Jornadas" });
    await user.type(search, "inexistente");
    expect(screen.getByText("Nenhuma Jornada encontrada para esta busca.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova Jornada" })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "cronicas");
    expect(card("Crônicas do Vale")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "O Selo de Elmora" })).not.toBeInTheDocument();
    await user.clear(search);
    expect(within(card("O Selo de Elmora")).getByText("Em Cena")).toBeInTheDocument();
    expect(card("Crônicas do Vale")).toBeInTheDocument();
  });

  it("busca por personagem e Mundo, mas não pelo lugar", async () => {
    const journey = summary({ character_name: "Lúcia", world_name: "Brumária", location: "Porto Cinzento" });
    const { user } = await openList({ journeys: [journey, SECOND] });
    const search = await screen.findByRole("searchbox", { name: "Buscar Jornadas" });
    for (const term of ["lucia", "brumaria"]) {
      await user.clear(search);
      await user.type(search, term);
      expect(card("O Selo de Elmora")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Crônicas do Vale" })).not.toBeInTheDocument();
    }
    await user.clear(search);
    await user.type(search, "porto cinzento");
    expect(screen.getByText("Nenhuma Jornada encontrada para esta busca.")).toBeInTheDocument();
  });

  it.each(["mais_nova", "sem_mundo"] as const)("impede continuar quando a situação é %s", async (status) => {
    await openList({ journeys: [summary({ status })] });
    await screen.findByRole("button", { name: "O Selo de Elmora" });
    expect(detail().getByRole("alert")).toBeInTheDocument();
    expect(detail().getByRole("button", { name: "Continuar Jornada" })).toBeDisabled();
    expect(detail().queryByRole("button", { name: /Restaurar/ })).not.toBeInTheDocument();
  });

  it("Excluir pede confirmação, apaga com confirm=true e preserva o Mundo", async () => {
    const { user, api } = await openList({ journeys: [summary(), SECOND], lastJourneyId: summary().id });
    await user.click(await screen.findByRole("button", { name: "O Selo de Elmora" }));
    await user.click(detail().getByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("dialog", { name: "Excluir “O Selo de Elmora”?" });
    expect(dialog).toHaveAccessibleDescription(/apaga a Jornada do disco/);
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Excluir do disco" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls).toContainEqual({ method: "DELETE", path: `/journeys/${summary().id}?confirm=true`, body: undefined });
    await waitFor(() => expect(screen.queryByText("O Selo de Elmora")).not.toBeInTheDocument());
    expect(screen.getAllByText(/O Mundo dela continua salvo/).length).toBeGreaterThan(0);
    expect(api.state.worlds.has(WORLD_ID)).toBe(true);
  });

  it("Cancelar a exclusão não apaga nada", async () => {
    const { user, api } = await openList({ journeys: [summary()] });
    await screen.findByRole("button", { name: "O Selo de Elmora" });
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(card("O Selo de Elmora")).toBeInTheDocument();
  });

  it("Restaurar uma Jornada danificada: escolhe o backup e confirma", async () => {
    const damaged = summary({ status: "danificada", error_code: "banco_danificado", error_message: "Arquivo inválido." });
    const { user, api } = await openList({
      journeys: [damaged],
      backups: [
        { name: "journey-v2-20261122-101500.db", schema_version: 2, created: "20261122-101500", size_bytes: 40960 },
        { name: "journey-v1-20261120-080000.db", schema_version: 1, created: "20261120-080000", size_bytes: 20480 },
      ],
    });
    await screen.findByRole("button", { name: "O Selo de Elmora" });
    const item = card("O Selo de Elmora");
    expect(within(item).getByText("Danificada")).toBeInTheDocument();
    expect(detail().queryByRole("button", { name: "Continuar Jornada" })).not.toBeInTheDocument();
    await user.click(detail().getByRole("button", { name: "Restaurar…" }));

    const dialog = await screen.findByRole("dialog", { name: "Restaurar “O Selo de Elmora”" });
    const newest = await within(dialog).findByRole("radio", { name: "22/11/2026 às 10:15:00" });
    expect(newest).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: "20/11/2026 às 08:00:00" }));
    await user.click(within(dialog).getByRole("button", { name: "Restaurar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls).toContainEqual({
      method: "POST",
      path: `/journeys/${damaged.id}/restore`,
      body: { backup: "journey-v1-20261120-080000.db" },
    });
    expect(screen.getAllByText(/Jornada restaurada a partir de journey-v1-20261120-080000.db/).length).toBeGreaterThan(0);
    await waitFor(() => expect(detail().getByText("Pronta")).toBeInTheDocument());
  });

  it("Restaurar sem backups explica que não há o que restaurar", async () => {
    const { user } = await openList({ journeys: [summary({ status: "danificada" })], backups: [] });
    await user.click(await screen.findByRole("button", { name: "Restaurar…" }));
    expect(await screen.findByText("Não há backups desta Jornada.")).toBeInTheDocument();
  });

  it("Menu volta ao menu inicial", async () => {
    const { user } = await openList({});
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Henduran" })).toHaveFocus();
  });
});
