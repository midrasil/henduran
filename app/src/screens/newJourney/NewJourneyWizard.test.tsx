import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse } from "../../test/fakeFetch";
import { createFakeGameApi, type FakeGameOptions } from "../../test/fakeGameApi";
import { RULES, VALID_DRAFT, WORLD, WORLD_SCHEMA } from "../../test/gameData";
import { NewJourneyWizard } from "./NewJourneyWizard";

// Fluxos longos de digitação do assistente passam de 5 s em máquina lenta.
vi.setConfig({ testTimeout: 20000 });

const INFO = { port: 5000, token: "t" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(options: FakeGameOptions = {}) {
  const api = createFakeGameApi(options);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const handled = api.handle(url, init);
      if (handled) return handled;
      throw new Error(`rota inesperada: ${url}`);
    }),
  );
  const onCreated = vi.fn(async () => undefined);
  const onCancel = vi.fn();
  const user = userEvent.setup();
  // Sorteio fixo: a sequência 0,1 reproduz a ordem do catálogo nas distribuições.
  let n = 0;
  const random = () => ((n++ * 0.37) % 1);
  render(
    <NewJourneyWizard
      info={INFO}
      rules={RULES}
      schema={WORLD_SCHEMA}
      onCreated={onCreated}
      onCancel={onCancel}
      makeSeed={() => 42}
      random={random}
      validationDelayMs={0}
    />,
  );
  return { api, user, onCreated, onCancel };
}

const stepTitle = () => screen.getByRole("heading", { level: 3, name: /^Passo \d de 3/ });

async function generate(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Gerar mundo" }));
  return screen.findByDisplayValue(`${WORLD.name} 42`);
}

async function finishWorld(user: UserEvent) {
  await generate(user);
  await user.click(screen.getByRole("radio", { name: WORLD.places[1]!.name }));
  await waitFor(() => expect(screen.getByText("Mundo válido.")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Avançar" }));
  await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3: Protagonista"));
}

/** Preenche colando (mais rápido que digitar letra a letra). */
async function fill(user: UserEvent, el: HTMLElement, text: string) {
  await user.click(el);
  await user.paste(text);
}

async function fillCharacter(user: UserEvent) {
  await fill(user, screen.getByRole("textbox", { name: "Nome" }), VALID_DRAFT.name);
  await fill(user, screen.getByRole("textbox", { name: "Conceito" }), VALID_DRAFT.concept);
  await fill(user, screen.getByRole("textbox", { name: "Aparência" }), "Alta.");
  await fill(user, screen.getByRole("textbox", { name: "História" }), "Cresceu no porto.");
  await fill(user, screen.getByRole("textbox", { name: "Ambição" }), VALID_DRAFT.ambition);
  await fill(user, screen.getByRole("textbox", { name: "Desejo" }), VALID_DRAFT.desire);
  const convictions = screen.getAllByRole("textbox", { name: "Convicção" });
  const pillars = screen.getAllByRole("textbox", { name: "Pilar" });
  for (let i = 0; i < convictions.length; i++) {
    await fill(user, convictions[i]!, `Convicção ${i + 1}`);
    await fill(user, pillars[i]!, `Pilar ${i + 1}`);
  }
  const attributes = screen.getByRole("group", { name: "Valores dos Atributos" });
  await user.click(within(attributes).getByRole("button", { name: "Distribuir ao acaso" }));
  const skills = screen.getByRole("group", { name: "Valores das Perícias" });
  await user.click(within(skills).getByRole("button", { name: "Distribuir ao acaso" }));
}

describe("Nova Jornada — passo 1, Mundo", () => {
  it("não avança sem Mundo; gera, mostra a semente e o conteúdo editável", async () => {
    const { user, api } = setup();
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3: Mundo");
    expect(screen.getByRole("navigation", { name: "Passos da Nova Jornada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Avançar" }));
    expect(await screen.findByText("Gere um Mundo antes de avançar.")).toBeInTheDocument();

    await generate(user);
    expect(screen.getByRole("textbox", { name: "Semente" })).toHaveValue("42");
    expect(api.calls.find((c) => c.path === "/worlds/generate")?.body).toEqual({ seed: 42 });
    expect(screen.getByRole("textbox", { name: "Nome da era" })).toHaveValue(WORLD.era.name);
    expect(screen.getByRole("textbox", { name: "Nome do tom" })).toHaveValue(WORLD.tone.name);
    expect(screen.getByRole("textbox", { name: "Nome do calendário" })).toHaveValue(WORLD.calendar.name);
    expect(screen.getAllByRole("textbox", { name: /^Nome do mês \d+$/ })).toHaveLength(WORLD.calendar.months.length);
    expect(screen.getByRole("button", { name: "Gerar outro" })).toBeInTheDocument();
  });

  it("gera com a semente digitada e recusa semente inválida no cliente", async () => {
    const { user, api } = setup();
    const seed = screen.getByRole("textbox", { name: "Semente" });
    await user.type(seed, "abc");
    await user.click(screen.getByRole("button", { name: "Usar esta semente" }));
    expect(seed).toHaveAccessibleDescription(/A semente deve ser um número inteiro/);
    await user.clear(seed);
    await user.type(seed, "476");
    await user.click(screen.getByRole("button", { name: "Usar esta semente" }));
    expect(await screen.findByDisplayValue(`${WORLD.name} 476`)).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/worlds/generate")?.body).toEqual({ seed: 476 });
  });

  it("mostra o erro do servidor junto do campo e só avança com o Mundo válido e o lugar escolhido", async () => {
    const { user } = setup();
    const name = await generate(user);
    await user.clear(name);
    const field = screen.getByRole("textbox", { name: "Nome do Mundo" });
    await waitFor(() => expect(field).toHaveAccessibleDescription("O nome do Mundo é obrigatório(a)."));
    expect(field).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(field).toHaveFocus());
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3");
    const pending = screen.getByRole("region", { name: "Antes de avançar, resolva:" });
    expect(within(pending).getByRole("button", { name: "Escolha o lugar onde a Jornada começa." })).toBeInTheDocument();

    await user.type(field, "Terras de Teste");
    await user.click(screen.getByRole("radio", { name: WORLD.places[0]!.name }));
    await waitFor(() => expect(screen.getByText("Mundo válido.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3: Protagonista"));
    expect(stepTitle()).toHaveFocus();
  });

  it("adiciona e remove lugares dentro dos limites do esquema", async () => {
    const { user } = setup();
    await generate(user);
    const count = () => screen.getAllByRole("textbox", { name: "Tipo" }).length;
    const start = count();
    const add = screen.getByRole("button", { name: "Adicionar lugar" });
    for (let i = start; i < WORLD_SCHEMA.places.max; i++) await user.click(add);
    expect(count()).toBe(WORLD_SCHEMA.places.max);
    expect(add).toBeDisabled();
    const removes = () => screen.getAllByRole("button", { name: /^Remover o lugar/ });
    while (count() > WORLD_SCHEMA.places.min) await user.click(removes()[0]!);
    expect(removes()[0]).toBeDisabled();
  });

  it("pede confirmação antes de substituir um Mundo editado", async () => {
    const { user, api } = setup();
    const name = await generate(user);
    await user.type(name, " editado");
    await user.click(screen.getByRole("button", { name: "Gerar outro" }));
    const dialog = screen.getByRole("dialog", { name: "Gerar outro Mundo?" });
    await user.click(within(dialog).getByRole("button", { name: "Manter este" }));
    expect(api.state.generated).toBe(1);
    expect(screen.getByDisplayValue(`${WORLD.name} 42 editado`)).toBeInTheDocument();
  });
});

describe("Nova Jornada — passo 2, Protagonista", () => {
  it("resume o que falta e mostra os erros só depois de tocar no campo ou tentar avançar", async () => {
    const { user } = setup();
    await finishWorld(user);
    const summaryBox = screen.getByRole("region", { name: "O que falta" });
    await waitFor(() => expect(within(summaryBox).getAllByText(/pendência/).length).toBeGreaterThan(0));
    const name = screen.getByRole("textbox", { name: "Nome" });
    expect(name).not.toHaveAttribute("aria-invalid");

    // Tocado e deixado vazio: o erro aparece.
    await user.click(name);
    await user.tab();
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    expect(name).toHaveAccessibleDescription(/O nome é obrigatório/);
    expect(screen.getByRole("textbox", { name: "Conceito" })).not.toHaveAttribute("aria-invalid");

    // Avançar: mostra todos, a lista de pendências e leva o foco ao primeiro erro.
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(name).toHaveFocus());
    expect(screen.getByRole("textbox", { name: "Conceito" })).toHaveAttribute("aria-invalid", "true");
    const pending = screen.getByRole("region", { name: "Antes de avançar, resolva:" });
    await user.click(within(pending).getByRole("button", { name: "Escolha um perfil de Perícias." }));
    expect(stepTitle()).toHaveTextContent("Passo 2 de 3");
  });

  it("mostra os valores que faltam na distribuição e destaca conflitos", async () => {
    const { user } = setup();
    await finishWorld(user);
    const group = screen.getByRole("group", { name: "Valores dos Atributos" });
    expect(within(group).getByText(/Ainda faltam:/).parentElement).toHaveTextContent("1 em 4, 2 em 3, 2 em 2 e 1 em 1");
    const forca = screen.getByRole("combobox", { name: "Força" });
    const agilidade = screen.getByRole("combobox", { name: "Agilidade" });
    await user.selectOptions(forca, "4");
    expect(within(group).getByText(/Ainda faltam:/).parentElement).toHaveTextContent("2 em 3, 2 em 2 e 1 em 1");
    await user.selectOptions(agilidade, "4");
    expect(agilidade).toHaveAccessibleDescription(/O valor 4 passou da conta/);
    expect(within(group).getByText(/Passou da conta: 1 em 4/)).toBeInTheDocument();
  });

  it("Distribuir ao acaso usa o catálogo e as derivadas vêm do servidor", async () => {
    const { user } = setup();
    await finishWorld(user);
    const group = screen.getByRole("group", { name: "Valores dos Atributos" });
    await user.click(within(group).getByRole("button", { name: "Distribuir ao acaso" }));
    expect(within(group).getByText("Todos os valores foram usados.")).toBeInTheDocument();
    const values = RULES.attributes.map((a) => Number((screen.getByRole("combobox", { name: a.name }) as HTMLSelectElement).value));
    expect([...values].sort()).toEqual([...RULES.attribute_distribution].sort());
    const vigor = Number((screen.getByRole("combobox", { name: "Vigor" }) as HTMLSelectElement).value);
    await waitFor(() =>
      expect(screen.getByRole("img", { name: new RegExp(`^Vida: ${3 + vigor} espaços`) })).toBeInTheDocument(),
    );

    const skills = screen.getByRole("group", { name: "Valores das Perícias" });
    await user.click(within(skills).getByRole("button", { name: "Distribuir ao acaso" }));
    expect(within(skills).getByText("Todos os valores do perfil foram usados.")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(true);
  });

  it("Voltar preserva o Mundo e Avançar só com o rascunho válido", async () => {
    const { user } = setup();
    await finishWorld(user);
    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Ilsa");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3");
    expect(screen.getByDisplayValue(`${WORLD.name} 42`)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: WORLD.places[1]!.name })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3"));
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Ilsa");

    await fillCharacter(user);
    await user.clear(screen.getByRole("textbox", { name: "Nome" }));
    await fill(user, screen.getByRole("textbox", { name: "Nome" }), VALID_DRAFT.name);
    await waitFor(() => expect(screen.getByText("Tudo certo. Pode avançar.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3: Revisão"));
  });
});

describe("Nova Jornada — Cancelar", () => {
  it("sem nada preenchido, sai direto", async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("com dados, pede confirmação", async () => {
    const { user, onCancel } = setup();
    await generate(user);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialog = screen.getByRole("dialog", { name: "Descartar a Nova Jornada?" });
    expect(within(dialog).getByRole("button", { name: "Continuar editando" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Continuar editando" }));
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Descartar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("Nova Jornada — passo 3, Revisão e criação", () => {
  async function toReview(user: UserEvent) {
    await finishWorld(user);
    await fillCharacter(user);
    await waitFor(() => expect(screen.getByText("Tudo certo. Pode avançar.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3: Revisão"));
  }

  it("resume o Mundo e o personagem e cria a Jornada com o nome padrão", async () => {
    const { user, api, onCreated } = setup();
    await toReview(user);
    const worldPanel = screen.getByRole("region", { name: "Mundo" });
    expect(within(worldPanel).getByText(`${WORLD.name} 42`)).toBeInTheDocument();
    expect(within(worldPanel).getByText(new RegExp(WORLD.places[1]!.name))).toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: "Nome da Jornada (opcional)" });
    expect(name).toHaveAccessibleDescription(`Se ficar em branco, será “A Jornada de ${VALID_DRAFT.name}”.`);

    await user.click(screen.getByRole("button", { name: "Criar Jornada" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const call = api.calls.find((c) => c.method === "POST" && c.path === "/journeys");
    const body = call?.body as { name?: string; start_place_id: string; character: { name: string } };
    expect(body.name).toBeUndefined();
    expect(body.start_place_id).toBe(WORLD.places[1]!.id);
    expect(body.character.name).toBe(VALID_DRAFT.name);
  });

  it("campos opcionais do Protagonista (idade, altura, origem, personalidade) vão na criação e aparecem na Revisão", async () => {
    const { user, api } = setup();
    await finishWorld(user);
    const age = screen.getByRole("textbox", { name: "Idade (opcional)" });
    expect(age).toHaveAttribute("maxLength", String(RULES.text_limits.age));
    expect(screen.getByRole("textbox", { name: "Personalidade (opcional)" })).toHaveAttribute("maxLength", String(RULES.text_limits.personality));
    await fill(user, age, "27 anos");
    await fill(user, screen.getByRole("textbox", { name: "Origem (opcional)" }), "Palafitas de Vel");
    await fill(user, screen.getByRole("textbox", { name: "Personalidade (opcional)" }), "Calada e teimosa.");
    await fillCharacter(user);
    await waitFor(() => expect(screen.getByText("Tudo certo. Pode avançar.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3: Revisão"));

    const hero = screen.getByRole("region", { name: "Protagonista" });
    expect(within(hero).getByText("27 anos")).toBeInTheDocument();
    expect(within(hero).getByText("Palafitas de Vel")).toBeInTheDocument();
    expect(within(hero).getByText("Calada e teimosa.")).toBeInTheDocument();
    // Altura ficou em branco: não informada, e não vai no rascunho.
    expect(within(hero).getAllByText("não informada").length).toBe(1);

    await user.click(screen.getByRole("button", { name: "Criar Jornada" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "POST" && c.path === "/journeys")).toBe(true));
    const body = api.calls.find((c) => c.method === "POST" && c.path === "/journeys")?.body as { character: Record<string, unknown> };
    expect(body.character.age).toBe("27 anos");
    expect(body.character.origin).toBe("Palafitas de Vel");
    expect(body.character.personality).toBe("Calada e teimosa.");
    expect(body.character).not.toHaveProperty("height");
  });

  it("422 volta ao passo do erro e destaca o campo, sem perder o que foi preenchido", async () => {
    const { user, onCreated } = setup({
      createResponse: () =>
        jsonResponse(
          {
            detail: {
              code: "criacao_invalida",
              message: "Os dados da Nova Jornada têm erros; nada foi criado.",
              errors: [{ field: "character.concept", code: "muito_longo", message: "O Conceito deve ter até 300 caracteres." }],
            },
          },
          422,
        ),
    });
    await toReview(user);
    await user.click(screen.getByRole("button", { name: "Criar Jornada" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3"));
    const concept = screen.getByRole("textbox", { name: "Conceito" });
    await waitFor(() => expect(concept).toHaveFocus());
    expect(concept).toHaveAccessibleDescription(/O Conceito deve ter até 300 caracteres/);
    expect(concept).toHaveValue(VALID_DRAFT.concept);
    expect(screen.getByRole("alert")).toHaveTextContent("nada foi criado");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("outro erro fica na Revisão com mensagem clara", async () => {
    const { user, onCreated } = setup({
      createResponse: () =>
        jsonResponse({ detail: { code: "criacao_falhou", message: "Falhou ao gravar.", step: "criar_mundo" } }, 500),
    });
    await toReview(user);
    await user.type(screen.getByRole("textbox", { name: "Nome da Jornada (opcional)" }), "Crônicas");
    await user.click(screen.getByRole("button", { name: "Criar Jornada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível criar a Jornada (etapa: criar_mundo): Falhou ao gravar.");
    expect(stepTitle()).toHaveTextContent("Passo 3 de 3");
    expect(screen.getByRole("textbox", { name: "Nome da Jornada (opcional)" })).toHaveValue("Crônicas");
    expect(onCreated).not.toHaveBeenCalled();
  });
});
