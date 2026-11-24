import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EngineStatus } from "../../api/engine";
import { ENGINE_IDLE, INFO } from "../../test/appHarness";
import { controlledSse, sse, sseResponse } from "../../test/fakeFetch";
import { createFakeGameApi, type FakeGameOptions, type FillBody } from "../../test/fakeGameApi";
import { RULES, VALID_DRAFT, WORLD, WORLD_SCHEMA } from "../../test/gameData";
import { NewJourneyWizard } from "./NewJourneyWizard";

/*
 * Narrador que preenche dados (ADR-077, item 3), como no protótipo ("Narrador (preenchimento)":
 * Pronto, Sem modelo e Com erro). O serviço falso devolve resultados de teste; a validação real
 * (limites, distribuição, HTML) é do serviço e está nos testes do backend.
 */

vi.setConfig({ testTimeout: 30000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

const NO_MODEL = { ...ENGINE_IDLE, provider: "local", installed: false } as EngineStatus;

function setup(options: FakeGameOptions = {}, engine: EngineStatus | null = null) {
  const api = createFakeGameApi(options);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const handled = api.handle(url, init);
      if (handled) return handled;
      throw new Error(`rota inesperada: ${url}`);
    }),
  );
  const user = userEvent.setup();
  render(
    <NewJourneyWizard
      info={INFO}
      rules={RULES}
      schema={WORLD_SCHEMA}
      onCreated={vi.fn(async () => undefined)}
      onCancel={vi.fn()}
      makeSeed={() => 42}
      validationDelayMs={0}
      engine={engine}
    />,
  );
  return { api, user };
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const fills = (api: ReturnType<typeof createFakeGameApi>) =>
  api.calls.filter((c) => c.method === "POST" && c.path === "/narrator/fill").map((c) => c.body as FillBody);

async function toCharacter(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Gerar mundo" }));
  await screen.findByDisplayValue(`${WORLD.name} 42`);
  await user.click(tab(/^Lugares/));
  await user.click(screen.getByRole("button", { name: new RegExp(`^Começar em ${WORLD.places[1]!.name}`) }));
  const footer = screen.getByRole("button", { name: /^Voltar/ }).closest("footer")!;
  await waitFor(() => expect(footer).toHaveTextContent("Passo completo"));
  await user.click(screen.getByRole("button", { name: /Avançar/ }));
  expect(await screen.findByRole("heading", { level: 3, name: /Passo 2 de 3/ })).toBeInTheDocument();
}

describe("Nova Jornada — Narrador que preenche dados", () => {
  it("Sugerir um campo preenche só ele, com o Mundo e a ideia no pedido; Desfazer restaura", async () => {
    const { user, api } = setup();
    await toCharacter(user);
    await user.type(screen.getByRole("textbox", { name: "Ideia para o Narrador (opcional)" }), "dívida antiga");
    await user.click(screen.getByRole("button", { name: "Sugerir o nome" }));
    expect(await screen.findByRole("status")).toHaveTextContent("O Narrador preencheu 1 campo.");
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Sugestão para name");
    const [body] = fills(api);
    expect(body).toMatchObject({ kind: "field", field: "name", idea: "dívida antiga", world: { name: `${WORLD.name} 42` } });
    expect(body!.world!.place).toContain(WORLD.places[1]!.name);
    await user.click(within(screen.getByRole("status")).getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("");
  });

  it("Preencher o que falta não toca no que já foi escrito", async () => {
    const { user, api } = setup();
    await toCharacter(user);
    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Ilsa");
    await user.click(screen.getByRole("button", { name: "Preencher o que falta" }));
    expect(await screen.findByText("O Narrador preencheu 2 campos.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Ilsa");
    expect(screen.getByRole("textbox", { name: "Conceito" })).toHaveValue("Sugestão para concept");
    expect(screen.getByRole("textbox", { name: "Aparência (opcional)" })).toHaveValue("Sugestão para appearance");
    expect(fills(api)[0]).toMatchObject({ kind: "missing", tab: "ident" });
    // Objetivos: Ambição, Desejo e as três Convicções com Pilar.
    await user.click(tab(/^Objetivos/));
    await user.click(screen.getByRole("button", { name: "Preencher o que falta" }));
    expect(await screen.findByText("O Narrador preencheu 8 campos.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ambição" })).toHaveValue("Sugestão para ambition");
    expect(screen.getAllByRole("textbox", { name: "Pilar" })[2]).toHaveValue("Sugestão para convictions[2].pillar");
  });

  it("Status: Sugerir Atributos e Sugerir perfil e Perícias aplicam a distribuição do serviço", async () => {
    const { user } = setup();
    await toCharacter(user);
    await user.click(tab(/^Status/));
    await user.click(screen.getByRole("button", { name: "Sugerir Atributos" }));
    expect(await screen.findByText("O Narrador preencheu 6 campos.")).toBeInTheDocument();
    const forca = RULES.attributes.find((a) => a.id === "forca")!;
    expect(screen.getByRole("button", { name: `${forca.name}: valor ${VALID_DRAFT.attributes.forca}` })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Sugerir perfil e Perícias" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Equilibrado/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Lutar: valor 3" })).toHaveAttribute("aria-pressed", "true");
  });

  it("História: Escrever troca o texto pelo HTML saneado do serviço; Continuar pede texto escrito", async () => {
    const { user, api } = setup();
    await toCharacter(user);
    await user.click(tab(/^História/));
    const toolbar = await screen.findByRole("toolbar", { name: "Formatação do texto" });
    expect(within(toolbar).getByRole("button", { name: "Continuar" })).toBeDisabled();
    await user.click(within(toolbar).getByRole("button", { name: "Escrever" }));
    const area = await screen.findByRole("textbox", { name: "História do personagem" });
    await waitFor(() => expect(area.querySelector("h3")?.textContent).toBe("Origens"));
    expect(fills(api)[0]).toMatchObject({ kind: "history", mode: "write" });
    await waitFor(() => expect(within(toolbar).getByRole("button", { name: "Continuar" })).toBeEnabled());
  });

  it("sem modelo: botões desabilitados com a dica e o aviso na barra", async () => {
    const { user, api } = setup({}, NO_MODEL);
    await toCharacter(user);
    const suggest = screen.getByRole("button", { name: "Sugerir o nome" });
    expect(suggest).toBeDisabled();
    expect(suggest).toHaveAttribute("title", "Carregue um modelo em Modelos");
    expect(screen.getByRole("button", { name: "Preencher o que falta" })).toBeDisabled();
    expect(screen.getByText(/Nenhum modelo carregado/)).toBeInTheDocument();
    expect(fills(api)).toHaveLength(0);
  });

  it("com erro: aviso claro e nada muda", async () => {
    const fillResponse = () =>
      sseResponse([
        sse("start", { id: "g" }),
        sse("error", { code: "proposta_invalida", message: "O Narrador não conseguiu sugerir uma resposta válida. Nada mudou; tente de novo." }),
      ]);
    const { user } = setup({ fillResponse });
    await toCharacter(user);
    await user.click(screen.getByRole("button", { name: "Sugerir o Conceito" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O Narrador não conseguiu sugerir uma resposta válida. Nada mudou; tente de novo.");
    expect(screen.getByRole("textbox", { name: "Conceito" })).toHaveValue("");
  });

  it("Pensando… enquanto espera; trocar de passo cancela o pedido", async () => {
    let signal: AbortSignal | null | undefined;
    const fillResponse = (_: FillBody, init: RequestInit) => {
      signal = init.signal;
      const stream = controlledSse(init.signal);
      stream.push(sse("start", { id: "g" }));
      return stream.response;
    };
    const { user } = setup({ fillResponse });
    await toCharacter(user);
    await user.click(screen.getByRole("button", { name: "Preencher o que falta" }));
    expect(await screen.findByText("Pensando…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sugerir o nome" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Voltar/ }));
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(screen.queryByText("Pensando…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
