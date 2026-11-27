import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EngineStatus } from "../../api/engine";
import { ENGINE_IDLE, INFO, stubGame } from "../../test/appHarness";
import { snapshotOf, summary, type FakeGameOptions } from "../../test/fakeGameApi";
import { OPENING_TEXT, sceneOf } from "../../test/fakeJourneyScreen";
import { RULES } from "../../test/gameData";
import { JourneyScreen, type PortraitRetry } from "./JourneyScreen";

vi.setConfig({ testTimeout: 20000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

const READY = { ...ENGINE_IDLE, provider: "fake" } as EngineStatus;
const NO_MODEL = { ...ENGINE_IDLE, provider: "local", installed: false } as EngineStatus;

function setup(
  options: FakeGameOptions = {},
  engine: EngineStatus = READY,
  prepare?: (api: ReturnType<typeof stubGame>["api"]) => void,
  portraitRetry: PortraitRetry | null = null,
) {
  const game = stubGame({ journeys: [summary()], ...options });
  const snapshot = snapshotOf(summary());
  game.api.state.open = snapshot;
  prepare?.(game.api);
  const onOpenModels = vi.fn();
  const copyText = vi.fn(async () => undefined);
  const user = userEvent.setup();
  render(
    <JourneyScreen
      info={INFO}
      snapshot={snapshot}
      rules={RULES}
      engine={engine}
      onOpenModels={onOpenModels}
      onBackToMenu={vi.fn()}
      copyText={copyText}
      portraitRetry={portraitRetry}
    />,
  );
  return { ...game, user, onOpenModels, copyText };
}

describe("Retrato da Nova Jornada não enviado", () => {
  const retry = (): PortraitRetry => ({
    file: new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "rosto.png", { type: "image/png" }),
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    reason: "O serviço não respondeu.",
  });

  it("avisa na tela e Tentar de novo envia o retrato (o aviso some)", async () => {
    const { user, api } = setup({}, READY, undefined, retry());
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("A Jornada foi criada, mas o retrato não foi enviado: O serviço não respondeu.");
    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.queryByText(/o retrato não foi enviado/)).not.toBeInTheDocument());
    expect(api.calls.filter((c) => c.method === "PUT" && c.path.startsWith("/journeys/current/portrait"))).toHaveLength(1);
    expect(await screen.findByText("Retrato salvo")).toBeInTheDocument();
  });

  it("falha de novo: o aviso fica com o motivo novo; Escolher outro abre o retrato da ficha; Fechar dispensa", async () => {
    const { user } = setup(
      { portraitError: { status: 422, code: "formato_invalido", message: "x" } },
      READY,
      undefined,
      retry(),
    );
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText(/Este arquivo não é uma imagem PNG, JPEG ou WebP/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Escolher outro" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText(/o retrato não foi enviado/)).not.toBeInTheDocument();
  });
});

const sent = (api: ReturnType<typeof stubGame>["api"], path: string) => api.calls.filter((c) => c.method === "POST" && c.path === path);

describe("Jornada sem abertura", () => {
  it("mostra a preparação, desabilita a digitação e gera a abertura", async () => {
    const { user, api } = setup({ history: "vazia" });
    expect(await screen.findByRole("heading", { name: "A história ainda não começou" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensagem para o Narrador da Cena" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(screen.getByText("A Cena inicial aparece aqui, no primeiro arco.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Gerar abertura" }));
    expect(await screen.findByText(OPENING_TEXT)).toBeInTheDocument();
    expect(sent(api, "/journeys/current/opening")).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Mensagem para o Narrador da Cena" })).toBeEnabled());
    // A Cena inicial entra no primeiro arco, como a Cena em andamento.
    const arcs = screen.getByRole("navigation", { name: "Arcos e Cenas" });
    expect(await within(arcs).findByRole("button", { name: /A chegada 10.*em andamento/ })).toHaveAttribute("aria-current", "true");
  });

  it("sem modelo: aviso com caminho para a configuração e Gerar abertura desabilitado", async () => {
    const { user, onOpenModels } = setup({ history: "vazia" }, NO_MODEL);
    expect(await screen.findByRole("heading", { name: "Falta preparar o Narrador" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar abertura" })).toBeDisabled();
    expect(screen.getByText(/O motor de IA ainda não foi baixado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Configurar modelo" }));
    expect(onOpenModels).toHaveBeenCalled();
  });
});

describe("Em Cena", () => {
  it("página de pergaminho com a abertura, ferramentas do cabeçalho e ações da mensagem", async () => {
    const { user, copyText, api } = setup();
    const log = await screen.findByRole("log", { name: "Conversa da Cena" });
    expect(await within(log).findByText(OPENING_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Página da Cena" })).toHaveClass("surface-parchment");
    expect(screen.getByRole("heading", { name: /A chegada 1/ })).toBeInTheDocument();
    expect(screen.getByText("Um estranho procura o personagem")).toBeInTheDocument();
    const tools = screen.getByRole("toolbar", { name: "Ferramentas da Cena" });
    expect(within(tools).getByRole("button", { name: "Aduran (não entra na Cena)" })).toBeInTheDocument();
    expect(within(tools).getByRole("button", { name: "Log desta Cena" })).toBeInTheDocument();
    expect(within(tools).getByRole("button", { name: "Encerrar Cena" })).toBeInTheDocument();

    const msg = within(log).getByRole("article", { name: "Narrador" });
    const actions = within(msg).getByRole("group", { name: "Ações da mensagem" });
    await user.click(within(actions).getByRole("button", { name: "Copiar" }));
    expect(copyText).toHaveBeenCalledWith(OPENING_TEXT);
    expect(await screen.findByText("Mensagem copiada")).toBeInTheDocument();
    // A última resposta do Narrador pode ser regenerada (canal da Cena).
    await user.click(within(actions).getByRole("button", { name: "Regenerar" }));
    expect(await within(log).findByText("Outra versão.")).toBeInTheDocument();
    expect(api.calls).toContainEqual({ method: "POST", path: "/journeys/current/messages/regenerate", body: { channel: "cena" } });
  });

  it("renomeia a Cena pelo lápis (PATCH) e mostra o erro do serviço", async () => {
    const { user, api } = setup();
    await user.click(await screen.findByRole("button", { name: "Renomear a Cena" }));
    const input = screen.getByRole("textbox", { name: "Nome da Cena" });
    expect(input).toHaveValue("A chegada 1");
    await user.clear(input);
    await user.click(input);
    await user.paste("x".repeat(81));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O título deve ter de 1 a 80 caracteres.");
    await user.clear(input);
    await user.click(input);
    await user.paste("A carta da garça");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: /A carta da garça/ })).toBeInTheDocument();
    expect(api.calls).toContainEqual({ method: "PATCH", path: "/journeys/current/scenes/1", body: { title: "A carta da garça" } });
    // A troca entra no Log da Cena.
    await user.click(screen.getByRole("button", { name: "Log desta Cena" }));
    expect(await screen.findByText(/Cena renomeada/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === "/journeys/current/events?scene_id=1")).toBe(true);
  });

  it("Aduran durante a Cena: margem do cronista, envia channel fora_de_cena e volta à Cena", async () => {
    const { user, api } = setup();
    await screen.findByRole("log", { name: "Conversa da Cena" });
    await user.click(screen.getByRole("button", { name: "Aduran (não entra na Cena)" }));
    expect(screen.getByRole("main", { name: "Margem do cronista" })).toHaveClass("surface-margin");
    expect(screen.getByText("Dúvidas e regras. O que você fala aqui não entra na Cena.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Mensagem para o Aduran" }), "Posso fugir?{Enter}");
    expect(await screen.findByText("O Aduran responde.")).toBeInTheDocument();
    expect(api.calls).toContainEqual({ method: "POST", path: "/journeys/current/messages", body: { content: "Posso fugir?", channel: "fora_de_cena" } });
    await user.click(screen.getByRole("button", { name: "Voltar à Cena" }));
    expect(await screen.findByRole("log", { name: "Conversa da Cena" })).toBeInTheDocument();
    expect(screen.queryByText("O Aduran responde.")).not.toBeInTheDocument();
  });

  it("encerrar a Cena pede confirmação e volta ao Aduran", async () => {
    const { user, api } = setup();
    await screen.findByRole("log", { name: "Conversa da Cena" });
    await user.click(screen.getByRole("button", { name: "Encerrar Cena" }));
    const dialog = screen.getByRole("dialog", { name: "Encerrar a Cena?" });
    await user.click(within(dialog).getByRole("button", { name: "Encerrar Cena" }));
    expect(await screen.findByRole("log", { name: "Conversa com o Aduran" })).toBeInTheDocument();
    expect(sent(api, "/journeys/current/scene/close")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Fora de Cena", () => {
  it("arcos em ordem e Cena encerrada abre só para leitura, com o resumo", async () => {
    const { user } = setup({ history: "fora_de_cena" }, READY, (api) => {
      api.state.screen.scenes.push(sceneOf(2, { status: "encerrada", title: "Costas para o cais", summary: "Ajudou os barqueiros." }));
      api.state.screen.messages.push({ id: 3, channel: "cena", scene_id: 2, role: "narrador", content: "O cais fede a sal.", status: "concluida", created_at: "x" });
    });
    await screen.findByRole("log", { name: "Conversa com o Aduran" });
    const arcs = screen.getByRole("navigation", { name: "Arcos e Cenas" });
    expect(within(arcs).getByText("Arco 1")).toBeInTheDocument();
    expect(within(arcs).getByText("Vingar o irmão morto na Ponte Velha")).toBeInTheDocument();

    const cards = await waitFor(() => {
      const list = within(arcs).getAllByRole("button", { name: /encerrada/ });
      expect(list).toHaveLength(2);
      return list;
    });
    expect(cards.map((c) => c.textContent)).toEqual([expect.stringContaining("A chegada 1"), expect.stringContaining("Costas para o cais")]);

    await user.click(cards[1]!);
    expect(await screen.findByText("Cena encerrada. Você pode ler, mas não escrever.")).toBeInTheDocument();
    expect(await screen.findByText("O cais fede a sal.")).toBeInTheDocument();
    expect(screen.getByText("Ajudou os barqueiros.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Mensagem/ })).not.toBeInTheDocument();
    const msg = screen.getByRole("article", { name: "Narrador" });
    expect(within(msg).queryByRole("button", { name: "Regenerar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar ao chat atual" }));
    expect(await screen.findByRole("log", { name: "Conversa com o Aduran" })).toBeInTheDocument();
  });

  it("o Aduran propõe uma Cena; Pedir outra troca a proposta e Agora não a recusa", async () => {
    const { user, api } = setup({ history: "fora_de_cena", propose: true });
    await screen.findByRole("log", { name: "Conversa com o Aduran" });
    await user.type(screen.getByRole("textbox", { name: "Mensagem para o Aduran" }), "Vou seguir os homens{Enter}");
    const card = await screen.findByRole("region", { name: "Proposta de Cena" });
    expect(within(card).getByText("Neblina no Porto Velho")).toBeInTheDocument();
    expect(within(card).getByText("lugar novo")).toBeInTheDocument();
    expect(within(card).getByText("Seguir os homens de capa cinzenta")).toBeInTheDocument();
    expect(within(card).getByText("Dois homens de capa cinzenta")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Pedir outra" }));
    expect(await within(screen.getByRole("region", { name: "Proposta de Cena" })).findByText("Outra Cena")).toBeInTheDocument();
    expect(sent(api, "/journeys/current/proposal/reroll")).toHaveLength(1);

    await user.click(within(screen.getByRole("region", { name: "Proposta de Cena" })).getByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Proposta de Cena" })).not.toBeInTheDocument());
    expect(sent(api, "/journeys/current/proposal/decline")).toHaveLength(1);
  });

  it("Começar a Cena aceita a proposta em SSE e abre a página da Cena nova", async () => {
    const { user, api } = setup({ history: "fora_de_cena", pendingProposal: true });
    const card = await screen.findByRole("region", { name: "Proposta de Cena" });
    await user.click(within(card).getByRole("button", { name: "Começar a Cena" }));
    expect(await screen.findByText("A neblina sobe do porto.")).toBeInTheDocument();
    expect(sent(api, "/journeys/current/proposal/accept")).toHaveLength(1);
    expect(await screen.findByRole("log", { name: "Conversa da Cena" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Neblina no Porto Velho/ })).toBeInTheDocument();
    expect(screen.getByText(/Becos do Porto Velho/)).toBeInTheDocument();
  });

  it("Log da Jornada mostra todos os eventos, do mais recente ao mais antigo", async () => {
    const { user, api } = setup({ history: "fora_de_cena" });
    await screen.findByRole("log", { name: "Conversa com o Aduran" });
    await user.click(screen.getByRole("button", { name: "Log da Jornada" }));
    const list = await screen.findByRole("list", { name: "Eventos da Jornada" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Cena encerrada");
    expect(items[1]).toHaveTextContent("Cena aberta");
    expect(api.calls.some((c) => c.path === "/journeys/current/events")).toBe(true);
  });
});

describe("Retrato", () => {
  it("mostra o erro do serviço em português ao enviar um arquivo inválido", async () => {
    const { user, api } = setup({ portraitError: { status: 422, code: "formato_invalido", message: "x" } });
    await user.click(await screen.findByRole("button", { name: "Trocar o retrato de Ilsa Corvalho" }));
    const dialog = screen.getByRole("dialog", { name: "Retrato do personagem" });
    const file = new File(["não é imagem"], "nota.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText(/Escolher imagem do computador/), file);
    await user.click(within(dialog).getByRole("button", { name: "Usar este retrato" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Este arquivo não é uma imagem PNG, JPEG ou WebP.");
    expect(api.calls.some((c) => c.method === "PUT" && c.path.startsWith("/journeys/current/portrait?x=0.5&y=0.5&zoom=1"))).toBe(true);
  });

  it("salva o retrato e o mostra com o enquadramento", async () => {
    const created: string[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => (created.push("u"), `blob:${created.length}`), revokeObjectURL: vi.fn() }));
    const { user, api } = setup();
    await user.click(await screen.findByRole("button", { name: "Trocar o retrato de Ilsa Corvalho" }));
    const dialog = screen.getByRole("dialog", { name: "Retrato do personagem" });
    const file = new File([new Uint8Array([137, 80, 78, 71])], "rosto.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText(/Escolher imagem do computador/), file);
    await user.click(within(dialog).getByRole("button", { name: "Usar este retrato" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Retrato salvo")).toBeInTheDocument();
    expect(api.state.screen.portrait?.crop).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    await waitFor(() => expect(api.calls.some((c) => c.method === "GET" && c.path === "/journeys/current/portrait")).toBe(true));
  });
});

describe("Pontos de retorno na Jornada aberta", () => {
  it("mostra o save padrão como linha atual, sem ações de ponto", async () => {
    const game = stubGame({ journeys: [summary()], returnPoints: [] });
    const snapshot = snapshotOf(summary());
    game.api.state.open = snapshot;
    const user = userEvent.setup();
    render(
      <JourneyScreen info={INFO} snapshot={snapshot} rules={RULES} engine={READY}
        onOpenModels={vi.fn()} onBackToMenu={vi.fn()} copyText={vi.fn(async () => undefined)}
        onPointLoaded={vi.fn()} />,
    );
    await user.click(await screen.findByRole("button", { name: "Opções" }));
    await user.click(screen.getByRole("menuitem", { name: "Pontos de retorno" }));
    const dialog = await screen.findByRole("dialog", { name: "Pontos de retorno" });
    expect(within(dialog).getByText("Jogando agora")).toBeInTheDocument();
    expect(within(dialog).getByText("Atual")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Carregar Jogando agora/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
  });
});
