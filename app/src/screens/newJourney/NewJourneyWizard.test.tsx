import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse } from "../../test/fakeFetch";
import { createFakeGameApi, savedWorld, WORLD_ID, type FakeGameOptions } from "../../test/fakeGameApi";
import { RULES, VALID_DRAFT, WORLD, WORLD_SCHEMA } from "../../test/gameData";
import { NewJourneyWizard } from "./NewJourneyWizard";

// Fluxos longos de digitação do assistente passam de 5 s em máquina lenta.
vi.setConfig({ testTimeout: 30000 });

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
  const random = () => (n++ * 0.37) % 1;
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

const stepTitle = () => screen.getByRole("heading", { level: 3, name: /^(Passo \d de 3|Pronto para começar)/ });
const footer = () => screen.getByRole("button", { name: "Voltar" }).closest("footer")!;
const tab = (name: RegExp) => screen.getByRole("tab", { name });

async function generate(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: "Gerar mundo" }));
  return screen.findByDisplayValue(`${WORLD.name} 42`);
}

async function chooseStart(user: UserEvent, index = 1) {
  await user.click(tab(/^Lugares/));
  await user.click(screen.getByRole("button", { name: `Começar em ${WORLD.places[index]!.name}` }));
}

async function finishWorld(user: UserEvent) {
  await generate(user);
  await chooseStart(user);
  await waitFor(() => expect(footer()).toHaveTextContent("Passo completo"));
  await user.click(screen.getByRole("button", { name: "Avançar" }));
  await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3"));
}

/** Preenche colando (mais rápido que digitar letra a letra). */
async function fill(user: UserEvent, el: HTMLElement, text: string) {
  await user.click(el);
  await user.paste(text);
}

/** O editor da História é `contenteditable`: escreve direto no DOM e avisa com `input`. */
function writeHistory(html: string) {
  const area = screen.getByRole("textbox", { name: "História do personagem" });
  area.innerHTML = html;
  fireEvent.input(area);
}

async function fillCharacter(user: UserEvent) {
  await user.click(tab(/^Identidade/));
  await fill(user, screen.getByRole("textbox", { name: "Nome" }), VALID_DRAFT.name);
  await fill(user, screen.getByRole("textbox", { name: "Conceito" }), VALID_DRAFT.concept);
  await fill(user, screen.getByRole("textbox", { name: "Aparência" }), "Alta.");
  await user.click(tab(/^História/));
  writeHistory("<h3>Origens</h3><p>Cresceu no <b>porto</b>.</p>");
  await user.click(tab(/^Objetivos/));
  await fill(user, screen.getByRole("textbox", { name: "Ambição" }), VALID_DRAFT.ambition);
  await fill(user, screen.getByRole("textbox", { name: "Desejo" }), VALID_DRAFT.desire);
  const convictions = screen.getAllByRole("textbox", { name: "Convicção" });
  const pillars = screen.getAllByRole("textbox", { name: "Pilar" });
  for (let i = 0; i < convictions.length; i++) {
    await fill(user, convictions[i]!, `Convicção ${i + 1}`);
    await fill(user, pillars[i]!, `Pilar ${i + 1}`);
  }
  await user.click(tab(/^Status/));
  await user.click(screen.getByRole("button", { name: "Sortear Atributos" }));
  await user.click(screen.getByRole("button", { name: "Sortear Perícias" }));
}

async function toReview(user: UserEvent) {
  await finishWorld(user);
  await fillCharacter(user);
  await waitFor(() => expect(footer()).toHaveTextContent("Passo completo"));
  await user.click(screen.getByRole("button", { name: "Avançar" }));
  await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3"));
}

async function toStart(user: UserEvent) {
  await toReview(user);
  await user.click(screen.getByRole("button", { name: "Avançar" }));
  await waitFor(() => expect(stepTitle()).toHaveTextContent("Pronto para começar"));
}

const createBody = (api: ReturnType<typeof setup>["api"]) =>
  api.calls.find((c) => c.method === "POST" && c.path === "/journeys")?.body as {
    name?: string;
    description?: string;
    world: { content?: { name: string }; seed?: number; id?: string };
    start_place_id: string;
    character: { name: string; history: string; history_html?: string };
  };

describe("Nova Jornada — trilho, cabeçalho e rodapé", () => {
  it("tem os três passos e o item Iniciar Jornada; os seguintes não são clicáveis", async () => {
    setup();
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3: Escolha o Mundo");
    const nav = screen.getByRole("navigation", { name: "Passos da Nova Jornada" });
    const steps = within(nav).getAllByRole("button");
    expect(steps.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Mundo"),
      expect.stringContaining("Protagonista"),
      expect.stringContaining("Revisão"),
      expect.stringContaining("Iniciar Jornada"),
    ]);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveTextContent("Em andamento");
    expect(steps[1]).toBeDisabled();
    expect(steps[1]).toHaveTextContent("A fazer");
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("O Mundo define o cenário");
    await waitFor(() => expect(screen.getByText(/Você ainda não tem Mundos salvos/)).toBeInTheDocument());
  });
});

describe("Nova Jornada — passo 1, Mundo", () => {
  it("sem Mundo, Avançar pede um; gerar mostra a semente, os chips e as abas", async () => {
    const { user, api } = setup();
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    expect(await screen.findByText("Gere um Mundo para continuar.")).toBeInTheDocument();
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3");

    await generate(user);
    expect(api.calls.find((c) => c.path === "/worlds/generate")?.body).toEqual({ seed: 42 });
    expect(screen.getByRole("textbox", { name: "Semente" })).toHaveValue("42");
    expect(screen.getByText("semente 42")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Novo · salvo ao criar a Jornada/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Nome da era" })).toHaveValue(WORLD.era.name);
    await user.click(tab(/^Calendário/));
    expect(screen.getAllByRole("textbox", { name: /^Nome do mês \d+$/ })).toHaveLength(WORLD.calendar.months.length);
    // O lugar inicial falta: a aba Lugares tem selo e o rodapé diz o que falta.
    await waitFor(() => expect(tab(/^Lugares/)).toHaveAccessibleName("Lugares (1 pendência)"));
    expect(footer()).toHaveTextContent("Faltam: Lugares");
  });

  it("gera com a semente digitada e recusa semente inválida no cliente", async () => {
    const { user, api } = setup();
    const seed = screen.getByRole("textbox", { name: "Semente" });
    await user.type(seed, "abc");
    await user.click(screen.getByRole("button", { name: "Usar" }));
    expect(seed).toHaveAccessibleDescription(/A semente deve ser um número inteiro/);
    await user.clear(seed);
    await user.type(seed, "476");
    await user.click(screen.getByRole("button", { name: "Usar" }));
    expect(await screen.findByDisplayValue(`${WORLD.name} 476`)).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/worlds/generate")?.body).toEqual({ seed: 476 });
  });

  it("Avançar vai à próxima aba incompleta; na aba incompleta fica e mostra os erros", async () => {
    const { user } = setup();
    await generate(user);
    await waitFor(() => expect(footer()).toHaveTextContent("Faltam: Lugares"));
    // Visão geral completa: Avançar leva à aba Lugares (sem mostrar erros ainda).
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(tab(/^Lugares/)).toHaveAttribute("aria-selected", "true"));
    expect(screen.queryByText("Escolha o lugar onde a Jornada começa.")).not.toBeInTheDocument();
    // Na aba incompleta, Avançar fica e mostra o erro, com o foco nele.
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    const start = await screen.findByText("Escolha o lugar onde a Jornada começa.");
    await waitFor(() => expect(start).toHaveFocus());
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3");
    const nav = screen.getByRole("navigation", { name: "Passos da Nova Jornada" });
    expect(within(nav).getAllByRole("button")[0]).toHaveTextContent("Em andamento");

    await user.click(screen.getByRole("button", { name: `Começar em ${WORLD.places[0]!.name}` }));
    expect(screen.getByRole("button", { name: `A Jornada começa em ${WORLD.places[0]!.name}` })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(footer()).toHaveTextContent("Passo completo"));
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3: Crie o Protagonista"));
    expect(stepTitle()).toHaveFocus();
    expect(within(nav).getAllByRole("button")[0]).toHaveTextContent("Completo");
  });

  it("erro do servidor marca a aba; o campo fica vermelho só depois de tentar avançar", async () => {
    const { user } = setup();
    const name = await generate(user);
    await chooseStart(user);
    await user.click(tab(/^Visão geral/));
    await user.clear(screen.getByRole("textbox", { name: "Nome do Mundo" }));
    await waitFor(() => expect(tab(/^Visão geral/)).toHaveAccessibleName("Visão geral (1 pendência)"));
    expect(name).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nome do Mundo" })).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByRole("textbox", { name: "Nome do Mundo" })).toHaveFocus();
    expect(screen.getByText("O nome do Mundo é obrigatório(a).")).toBeInTheDocument();
  });

  it("adiciona e remove lugares dentro dos limites do esquema", async () => {
    const { user } = setup();
    await generate(user);
    await user.click(tab(/^Lugares/));
    const count = () => screen.getAllByRole("textbox", { name: "Tipo" }).length;
    const add = screen.getByRole("button", { name: "Adicionar lugar" });
    for (let i = count(); i < WORLD_SCHEMA.places.max; i++) await user.click(add);
    expect(count()).toBe(WORLD_SCHEMA.places.max);
    expect(add).toBeDisabled();
    const removes = () => screen.getAllByRole("button", { name: /^Remover o lugar/ });
    while (count() > WORLD_SCHEMA.places.min) await user.click(removes()[0]!);
    expect(removes()[0]).toBeDisabled();
    // Editado: a semente passa a ser gerada ao criar.
    expect(screen.getByText("semente gerada ao criar a Jornada")).toBeInTheDocument();
  });

  it("Criar do zero traz as linhas mínimas do esquema, sem semente", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Criar do zero" }));
    expect(screen.getByRole("textbox", { name: "Nome do Mundo" })).toHaveValue("");
    expect(screen.getByText("semente gerada ao criar a Jornada")).toBeInTheDocument();
    await user.click(tab(/^Calendário/));
    expect(screen.getAllByRole("textbox", { name: /^Nome do mês \d+$/ })).toHaveLength(WORLD_SCHEMA.months.min);
    expect(screen.getAllByRole("textbox", { name: /^Dia \d+ da semana$/ })).toHaveLength(WORLD_SCHEMA.weekdays.min);
    await user.click(tab(/^Religiões/));
    expect(screen.getAllByRole("textbox", { name: "Domínio" })).toHaveLength(WORLD_SCHEMA.religions.min);
    await user.click(tab(/^Lugares/));
    expect(screen.getAllByRole("textbox", { name: "Tipo" })).toHaveLength(WORLD_SCHEMA.places.min);
  });

  it("pede confirmação só para descartar um Mundo editado", async () => {
    const { user, api } = setup();
    const name = await generate(user);
    // Sem edição: gerar de novo não pergunta.
    await user.click(screen.getByRole("button", { name: "Gerar mundo" }));
    await waitFor(() => expect(api.state.generated).toBe(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.type(await screen.findByDisplayValue(`${WORLD.name} 42`), " editado");
    expect(name).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Criar do zero" }));
    const dialog = screen.getByRole("dialog", { name: "Descartar o Mundo em edição?" });
    expect(within(dialog).getByRole("button", { name: "Manter este" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Manter este" }));
    expect(screen.getByDisplayValue(`${WORLD.name} 42 editado`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar mundo" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Descartar e continuar" }));
    await waitFor(() => expect(api.state.generated).toBe(3));
  });

  it("lista os Mundos salvos; um Mundo salvo é somente leitura e pode ser duplicado", async () => {
    const other = savedWorld({ id: "44444444-4444-4444-8444-444444444444", name: "Costa de Marvelhar", seed: null, journey_count: 0 });
    const { user, api } = setup({ savedWorlds: [savedWorld({ journey_count: 2 }), other] });
    const item = await screen.findByRole("option", { name: new RegExp(WORLD.name) });
    expect(item).toHaveTextContent(`semente 476 · Usado em 2 Jornadas`);
    expect(screen.getByRole("option", { name: /Costa de Marvelhar/ })).toHaveTextContent("sem semente · Ainda sem Jornadas");

    await user.click(item);
    const nameField = await screen.findByRole("textbox", { name: "Nome do Mundo" });
    expect(api.calls.some((c) => c.path === `/worlds/${WORLD_ID}`)).toBe(true);
    expect(nameField).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Nome da era" })).toHaveAttribute("readonly");
    expect(screen.getByText(/Este Mundo já está salvo e é usado em 2 Jornadas/)).toBeInTheDocument();
    await user.click(tab(/^Lugares/));
    expect(screen.getByRole("button", { name: "Adicionar lugar" })).toBeDisabled();
    // O lugar inicial continua sendo escolhido por Jornada.
    await user.click(screen.getByRole("button", { name: `Começar em ${WORLD.places[0]!.name}` }));
    expect(screen.getByRole("button", { name: `A Jornada começa em ${WORLD.places[0]!.name}` })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicar e editar" }));
    const copy = screen.getByRole("textbox", { name: "Nome do Mundo" });
    expect(copy).toHaveValue(`${WORLD.name} (cópia)`);
    expect(copy).not.toHaveAttribute("readonly");
    expect(screen.getByRole("option", { name: /Novo · salvo ao criar a Jornada/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("semente gerada ao criar a Jornada")).toBeInTheDocument();
  });

  it("erro ao listar os Mundos salvos aparece com Tentar de novo", async () => {
    setup({ worldsError: true });
    expect(await screen.findByText(/Não foi possível listar os Mundos salvos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("Nova Jornada — passo 2, Protagonista", () => {
  it("abas com selos; Avançar fica na aba incompleta, mostra os erros e leva o foco", async () => {
    const { user } = setup();
    await finishWorld(user);
    await waitFor(() => expect(tab(/^Identidade/)).toHaveAccessibleName(/Identidade \(\d+ pendências\)/));
    const name = screen.getByRole("textbox", { name: "Nome" });
    expect(name).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    expect(name).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Conceito" })).toHaveAttribute("aria-invalid", "true");
    expect(footer()).toHaveTextContent("Faltam: Identidade, História, Objetivos, Status");

    await fill(user, name, VALID_DRAFT.name);
    await fill(user, screen.getByRole("textbox", { name: "Conceito" }), VALID_DRAFT.concept);
    await fill(user, screen.getByRole("textbox", { name: "Aparência" }), "Alta.");
    await waitFor(() => expect(tab(/^Identidade/)).toHaveAccessibleName("Identidade (completa)"));
    // Identidade completa: Avançar vai à próxima incompleta (História).
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(tab(/^História/)).toHaveAttribute("aria-selected", "true"));
  });

  it("Atributos em botões de valor: os esgotados ficam desabilitados e as trilhas vêm do servidor", async () => {
    const { user } = setup();
    await finishWorld(user);
    await user.click(tab(/^Status/));
    const tally = screen.getAllByText("Valores usados:")[0]!.parentElement!;
    expect(tally).toHaveTextContent("4 0/1");
    await user.click(screen.getByRole("button", { name: "Força: valor 4" }));
    expect(screen.getByRole("button", { name: "Força: valor 4" })).toHaveAttribute("aria-pressed", "true");
    expect(tally).toHaveTextContent("4 1/1");
    // O único 4 foi usado: os outros Atributos não podem receber 4.
    expect(screen.getByRole("button", { name: "Agilidade: valor 4" })).toBeDisabled();
    // Clicar no valor atual limpa.
    await user.click(screen.getByRole("button", { name: "Força: valor 4" }));
    expect(screen.getByRole("button", { name: "Agilidade: valor 4" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Sortear Atributos" }));
    const vigor = RULES.attributes.find((a) => a.id === "vigor")!;
    const vigorValue = [1, 2, 3, 4].find((v) => screen.getByRole("button", { name: `${vigor.name}: valor ${v}` }).getAttribute("aria-pressed") === "true")!;
    await waitFor(() => expect(screen.getByRole("img", { name: new RegExp(`^Vida: ${3 + vigorValue} espaços`) })).toBeInTheDocument());
  });

  it("Perícias: perfil, quatro quadradinhos e valores sem vaga desabilitados; trocar de perfil zera", async () => {
    const { user } = setup();
    await finishWorld(user);
    await user.click(tab(/^Status/));
    expect(screen.getByText("Escolha um perfil para distribuir os valores.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lutar: valor 1" })).toBeDisabled();
    const especialista = RULES.skill_profiles.find((p) => p.id === "especialista")!;
    await user.click(screen.getByRole("button", { name: new RegExp(`^${especialista.name}`) }));
    await user.click(screen.getByRole("button", { name: "Lutar: valor 4" }));
    expect(screen.getByRole("button", { name: "Lutar: valor 4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Atletismo: valor 4" })).toBeDisabled();
    const equilibrado = RULES.skill_profiles.find((p) => p.id === "equilibrado")!;
    await user.click(screen.getByRole("button", { name: new RegExp(`^${equilibrado.name}`) }));
    expect(screen.getByRole("button", { name: "Lutar: valor 4" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Lutar: valor 4" })).toBeDisabled();
  });

  it("a História é a aba inteira, com barra de formatação e contador do texto puro", async () => {
    const { user } = setup();
    await finishWorld(user);
    await user.click(tab(/^História/));
    expect(screen.getByRole("toolbar", { name: "Formatação do texto" })).toBeInTheDocument();
    for (const label of ["Negrito (Ctrl+B)", "Itálico (Ctrl+I)", "Sublinhado (Ctrl+U)", "Tachado", "Lista com marcadores", "Lista numerada", "Citação", "Centralizar", "Desfazer (Ctrl+Z)", "Refazer (Ctrl+Y)", "Limpar formatação"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("combobox", { name: "Estilo do parágrafo" })).toBeInTheDocument();
    writeHistory("<h3>Origens</h3><p>Cresceu no <b>porto</b>.</p>");
    expect(screen.getByText(/4 palavras · 25\/4\.000 caracteres/)).toBeInTheDocument();
  });

  it("Voltar preserva o Mundo e o personagem", async () => {
    const { user } = setup();
    await finishWorld(user);
    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Ilsa");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3");
    expect(screen.getByDisplayValue(`${WORLD.name} 42`)).toBeInTheDocument();
    await user.click(tab(/^Lugares/));
    expect(screen.getByRole("button", { name: `A Jornada começa em ${WORLD.places[1]!.name}` })).toBeInTheDocument();
    await waitFor(() => expect(footer()).toHaveTextContent("Passo completo"));
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3"));
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Ilsa");
  });
});

describe("Nova Jornada — retrato", () => {
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "rosto.png", { type: "image/png" });

  it("a área do retrato abre o recorte; arquivo que não é imagem é recusado; o escolhido vai junto da Jornada criada", async () => {
    const { user, onCreated } = setup();
    await finishWorld(user);
    await user.click(screen.getByRole("button", { name: "Escolher o retrato" }));
    const dialog = screen.getByRole("dialog", { name: "Retrato do personagem" });
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
    await user.upload(input, new File(["não sou imagem"], "falso.png", { type: "image/png" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("não é uma imagem PNG, JPEG ou WebP");
    await user.upload(input, png());
    await user.click(within(dialog).getByRole("button", { name: "Usar este retrato" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar o retrato" })).toBeInTheDocument();

    await fillCharacter(user);
    await waitFor(() => expect(footer()).toHaveTextContent("Passo completo"));
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3"));
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await user.click(await screen.findByRole("button", { name: "Iniciar Jornada" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const extras = (onCreated.mock.calls[0] as unknown as [unknown, { portrait?: { file: File; crop: unknown } }])[1];
    expect(extras.portrait?.file.name).toBe("rosto.png");
    expect(extras.portrait?.crop).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
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

describe("Nova Jornada — Revisão e Iniciar Jornada", () => {
  it("Revisão em duas abas, com Editar Mundo e Editar Personagem", async () => {
    const { user } = setup();
    await toReview(user);
    expect(screen.getByRole("heading", { name: `${WORLD.name} 42` })).toBeInTheDocument();
    expect(screen.getByText("Mundo novo, salvo ao criar a Jornada")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/· a Jornada começa aqui/).closest(".nj-rcard")).toHaveTextContent(WORLD.places[1]!.name);
    await user.click(tab(/^Personagem/));
    expect(screen.getByRole("heading", { name: VALID_DRAFT.name })).toBeInTheDocument();
    // A História formatada aparece formatada (por lista permitida, sem innerHTML).
    expect(screen.getByRole("heading", { name: "Origens" })).toBeInTheDocument();
    expect(screen.getByText("porto").tagName).toBe("STRONG");
    expect(screen.getAllByText("não informada")).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Editar Personagem" }));
    expect(stepTitle()).toHaveTextContent("Passo 2 de 3");
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3"));
    await user.click(tab(/^Mundo/));
    await user.click(screen.getByRole("button", { name: "Editar Mundo" }));
    expect(stepTitle()).toHaveTextContent("Passo 1 de 3");
  });

  it("Iniciar Jornada: nome padrão, descrição e o corpo enviado ao servidor", async () => {
    const { user, api, onCreated } = setup();
    await toStart(user);
    const nav = screen.getByRole("navigation", { name: "Passos da Nova Jornada" });
    const steps = within(nav).getAllByRole("button");
    expect(steps.slice(0, 3).every((b) => b.textContent?.includes("Completo"))).toBe(true);
    expect(steps[3]).toHaveAttribute("aria-current", "step");
    const name = screen.getByRole("textbox", { name: "Nome da Jornada (opcional)" });
    expect(name).toHaveAttribute("placeholder", `A Jornada de ${VALID_DRAFT.name}`);
    expect(name).toHaveAccessibleDescription(`Se ficar em branco, será “A Jornada de ${VALID_DRAFT.name}”.`);
    const description = screen.getByRole("textbox", { name: "Descrição (opcional)" });
    expect(description).toHaveAttribute("maxLength", "2000");
    await fill(user, description, "Começa no porto, com uma dívida.");
    expect(screen.getByText(/Em Cena, em um período sorteado pelo jogo/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Iniciar Jornada" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const body = createBody(api);
    expect(body.name).toBeUndefined();
    expect(body.description).toBe("Começa no porto, com uma dívida.");
    expect(body.world.seed).toBe(42);
    expect(body.world.content?.name).toBe(`${WORLD.name} 42`);
    expect(body.start_place_id).toBe(WORLD.places[1]!.id);
    expect(body.character.history_html).toBe("<h3>Origens</h3><p>Cresceu no <b>porto</b>.</p>");
    expect(body.character.history).toBe("Origens\nCresceu no porto.");
  });

  it("num Mundo salvo, a criação aponta o id do Mundo", async () => {
    const { user, api, onCreated } = setup({ savedWorlds: [savedWorld()] });
    await user.click(await screen.findByRole("option", { name: new RegExp(WORLD.name) }));
    await screen.findByRole("textbox", { name: "Nome do Mundo" });
    await chooseStart(user, 0);
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3"));
    await fillCharacter(user);
    await waitFor(() => expect(footer()).toHaveTextContent("Passo completo"));
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 3 de 3"));
    expect(screen.getByText("Mundo salvo, já existente")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Avançar" }));
    await user.click(await screen.findByRole("button", { name: "Iniciar Jornada" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createBody(api).world).toEqual({ id: WORLD_ID });
    expect(createBody(api).start_place_id).toBe(WORLD.places[0]!.id);
  });

  it("422 volta ao passo e à aba do erro, sem perder o que foi preenchido", async () => {
    const { user, onCreated } = setup({
      createResponse: () =>
        jsonResponse(
          {
            detail: {
              code: "criacao_invalida",
              message: "Os dados da Nova Jornada têm erros; nada foi criado.",
              errors: [{ field: "character.ambition", code: "muito_longo", message: "A Ambição deve ter até 300 caracteres." }],
            },
          },
          422,
        ),
    });
    await toStart(user);
    await user.click(screen.getByRole("button", { name: "Iniciar Jornada" }));
    await waitFor(() => expect(stepTitle()).toHaveTextContent("Passo 2 de 3"));
    expect(tab(/^Objetivos/)).toHaveAttribute("aria-selected", "true");
    const ambition = screen.getByRole("textbox", { name: "Ambição" });
    await waitFor(() => expect(ambition).toHaveFocus());
    expect(ambition).toHaveAccessibleDescription(/A Ambição deve ter até 300 caracteres/);
    expect(ambition).toHaveValue(VALID_DRAFT.ambition);
    expect(screen.getByRole("alert")).toHaveTextContent("nada foi criado");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("outro erro fica na tela Iniciar Jornada, dizendo que nada foi gravado pela metade", async () => {
    let release: () => void = () => undefined;
    const { user, onCreated } = setup({
      createResponse: () => jsonResponse({ detail: { code: "criacao_falhou", message: "Falhou ao gravar.", step: "criar_mundo" } }, 500),
    });
    await toStart(user);
    await user.type(screen.getByRole("textbox", { name: "Nome da Jornada (opcional)" }), "Crônicas");
    await user.click(screen.getByRole("button", { name: "Iniciar Jornada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível iniciar a Jornada (etapa: criar_mundo): Falhou ao gravar. Nada foi gravado pela metade",
    );
    expect(stepTitle()).toHaveTextContent("Pronto para começar");
    expect(screen.getByRole("textbox", { name: "Nome da Jornada (opcional)" })).toHaveValue("Crônicas");
    expect(onCreated).not.toHaveBeenCalled();
    release();
  });

  it("Criando… desabilita o resto enquanto o servidor responde", async () => {
    let finish: (r: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => (finish = resolve));
    const { user } = setup({ createResponse: () => pending as unknown as Response });
    await toStart(user);
    await user.click(screen.getByRole("button", { name: "Iniciar Jornada" }));
    const busy = await screen.findByRole("button", { name: /Criando…/ });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Descrição (opcional)" })).toBeDisabled();
    finish(jsonResponse({ detail: { code: "criacao_falhou", message: "x" } }, 500));
    await screen.findByRole("alert");
  });
});
