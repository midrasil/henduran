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

const card = (name: string) => screen.getByText(name).closest("li")!;

describe("Tela Jornadas", () => {
  it("lista as Jornadas com personagem, local, mundo, salvamento, regras e estado", async () => {
    await openList({ journeys: [summary(), SECOND], lastJourneyId: summary().id });
    await screen.findByText("Crônicas do Vale");
    const first = card("O Selo de Elmora");
    expect(within(first).getByText("Última jogada")).toBeInTheDocument();
    expect(within(first).getByText("Pronta")).toBeInTheDocument();
    expect(within(first).getByText(/Ilsa Corvalho · .* · Mundo: /)).toBeInTheDocument();
    expect(within(first).getByText(/Salvo em: .* · Regras: fatia-1/)).toBeInTheDocument();
  });

  it("estado vazio", async () => {
    await openList({});
    expect(await screen.findByText(/Nenhuma Jornada salva/)).toBeInTheDocument();
  });

  it("Abrir leva à Jornada", async () => {
    const { user } = await openList({ journeys: [summary(), SECOND] });
    await screen.findByText("Crônicas do Vale");
    await user.click(within(card("Crônicas do Vale")).getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Crônicas do Vale" })).toBeInTheDocument();
  });

  it("Excluir pede confirmação, apaga com confirm=true e avisa que o Mundo foi junto", async () => {
    const { user, api } = await openList({ journeys: [summary(), SECOND], lastJourneyId: summary().id });
    await screen.findByText("O Selo de Elmora");
    await user.click(within(card("O Selo de Elmora")).getByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("dialog", { name: "Excluir “O Selo de Elmora”?" });
    expect(dialog).toHaveAccessibleDescription(/apaga a Jornada do disco/);
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Excluir do disco" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.calls).toContainEqual({ method: "DELETE", path: `/journeys/${summary().id}?confirm=true`, body: undefined });
    await waitFor(() => expect(screen.queryByText("O Selo de Elmora")).not.toBeInTheDocument());
    expect(screen.getAllByText(/O Mundo dela também foi apagado/).length).toBeGreaterThan(0);
    expect(api.state.worlds.has(WORLD_ID)).toBe(false);
  });

  it("Cancelar a exclusão não apaga nada", async () => {
    const { user, api } = await openList({ journeys: [summary()] });
    await screen.findByText("O Selo de Elmora");
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(screen.getByText("O Selo de Elmora")).toBeInTheDocument();
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
    await screen.findByText("O Selo de Elmora");
    const item = card("O Selo de Elmora");
    expect(within(item).getByText("Danificada")).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Abrir" })).toBeDisabled();
    await user.click(within(item).getByRole("button", { name: "Restaurar" }));

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
    await waitFor(() => expect(within(card("O Selo de Elmora")).getByText("Pronta")).toBeInTheDocument());
  });

  it("Restaurar sem backups explica que não há o que restaurar", async () => {
    const { user } = await openList({ journeys: [summary({ status: "danificada" })], backups: [] });
    await screen.findByText("O Selo de Elmora");
    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(await screen.findByText("Não há backups desta Jornada.")).toBeInTheDocument();
  });

  it("Menu volta ao menu inicial", async () => {
    const { user } = await openList({});
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Henduran" })).toHaveFocus();
  });
});
