/**
 * Rotas falsas da tela da Jornada (`/journeys/current/...`, backend/README.md):
 * histórico, abertura, mensagens, proposta, encerramento, arcos, Log, lugares e
 * retrato. Comportamento simplificado, só o necessário para os testes.
 */
import type { JourneyEvent, JourneyMessage } from "../api/journeyScreen";
import type { JourneySnapshot, PortraitInfo, SceneProposal, SceneView } from "../api/journeys";
import { jsonResponse, sse, sseResponse } from "./fakeFetch";
import { WORLD } from "./gameData";

export const CALENDAR = {
  year: WORLD.calendar.year ?? 1,
  month: 2,
  month_name: WORLD.calendar.months[1]!.name,
  day: 12,
  weekday: 0,
  weekday_name: WORLD.calendar.weekdays[0]!,
  era_label: WORLD.calendar.era_label,
};

export const OPENING_TEXT = "A chuva bate nas janelas da estalagem.";

export type FakeHistory = "vazia" | "em_cena" | "fora_de_cena";

export interface FakeScreenOptions {
  /** Histórico inicial: sem abertura, com a Cena inicial aberta (padrão) ou com ela encerrada. */
  history?: FakeHistory;
  /** Rotas do Narrador em SSE: devolva uma resposta para controlar o fluxo; `undefined` usa o padrão. */
  narrate?: (path: string, body: unknown, init: RequestInit) => Response | Promise<Response> | undefined;
  /** O Aduran propõe uma Cena a cada resposta Fora de Cena (como `HENDURAN_FAKE_PROPOSE=1`). */
  propose?: boolean;
  /** Proposta pendente desde o início (só Fora de Cena). */
  pendingProposal?: boolean;
  /** Erro de `PUT /journeys/current/portrait`. */
  portraitError?: { status: number; code: string; message: string };
}

export interface FakeScreen {
  messages: JourneyMessage[];
  scenes: SceneView[];
  proposal: SceneProposal | null;
  events: JourneyEvent[];
  portrait: PortraitInfo | null;
  nextId: number;
}

export function sceneOf(id: number, patch: Partial<SceneView> = {}): SceneView {
  const place = WORLD.places[0]!;
  return {
    id,
    status: "aberta",
    title: `A chegada ${id}`,
    opening_tone: "chegada",
    place_id: place.id,
    place_name: place.name,
    day_period: "noite",
    motive: "Um estranho procura o personagem",
    participants: ["Um estranho"],
    objective_id: 1,
    summary: null,
    opened_at: "2026-11-23T10:00:00+00:00",
    closed_at: null,
    ...patch,
  };
}

export function proposalOf(id: number, patch: Partial<SceneProposal> = {}): SceneProposal {
  return {
    id,
    status: "pendente",
    title: "Neblina no Porto Velho",
    place: { kind: "novo", id: null, name: "Becos do Porto Velho", type: "becos", description: "Vielas estreitas." },
    motive: "Seguir os homens de capa cinzenta",
    participants: ["Dois homens de capa cinzenta"],
    created_at: "2026-11-23T10:00:00+00:00",
    ...patch,
  };
}

const T0 = "2026-11-23T10:00:00+00:00";

export function initialScreen(options: FakeScreenOptions = {}): FakeScreen {
  const kind = options.history ?? "em_cena";
  const screen: FakeScreen = { messages: [], scenes: [], proposal: null, events: [], portrait: null, nextId: 10 };
  if (kind === "vazia") return screen;
  const closed = kind === "fora_de_cena";
  screen.scenes.push(sceneOf(1, closed ? { status: "encerrada", summary: "O estranho entregou uma carta.", closed_at: T0 } : {}));
  screen.messages.push({ id: 1, channel: "cena", scene_id: 1, role: "narrador", content: OPENING_TEXT, status: "concluida", created_at: T0 });
  screen.events.push({
    id: 1,
    kind: "cena_aberta",
    scene_id: 1,
    data: { title: "A chegada 1", place_id: "lugar-1", place_name: WORLD.places[0]!.name },
    day_period: "noite",
    calendar: CALENDAR,
    created_at: T0,
  });
  if (closed) {
    screen.events.push({
      id: 2,
      kind: "cena_encerrada",
      scene_id: 1,
      data: { title: "A chegada 1", summary: "O estranho entregou uma carta." },
      day_period: "noite",
      calendar: CALENDAR,
      created_at: T0,
    });
    if (options.pendingProposal) screen.proposal = proposalOf(5);
  }
  return screen;
}

const fail = (status: number, code: string, message: string) => jsonResponse({ detail: { code, message } }, status);

/** Roteador das rotas `/journeys/current/...` (menos `GET /journeys/current`, que é do roteador principal). */
export function createScreenHandler(state: { screen: FakeScreen; open: JourneySnapshot | null }, options: FakeScreenOptions = {}) {
  const sc = () => state.screen;
  const openScene = () => sc().scenes.find((s) => s.status === "aberta") ?? null;
  const mode = () => (openScene() ? "em_cena" : "fora_de_cena");
  const now = "2026-11-23T12:00:00+00:00";
  const nextId = () => sc().nextId++;
  const event = (kind: string, sceneId: number | null, data: Record<string, unknown>) =>
    sc().events.push({ id: nextId(), kind, scene_id: sceneId, data, day_period: "noite", calendar: CALENDAR, created_at: now });
  const message = (channel: "cena" | "fora_de_cena", sceneId: number | null, role: "narrador" | "jogador", content: string) => {
    const m: JourneyMessage = { id: nextId(), channel, scene_id: sceneId, role, content, status: "concluida", created_at: now };
    sc().messages.push(m);
    return m;
  };
  const lastOfChannel = (channel: string) => {
    const open = openScene();
    const list = sc().messages.filter((m) => m.channel === channel && (channel === "fora_de_cena" || m.scene_id === open?.id));
    return list[list.length - 1];
  };
  const NARRATION = /\/(opening|messages|messages\/regenerate|messages\/continue|proposal\/accept)$/;

  return async (method: string, path: string, query: URLSearchParams, body: unknown, init: RequestInit): Promise<Response> => {
    if (method === "POST" && NARRATION.test(path) && options.narrate) {
      const custom = await options.narrate(path, body, init);
      if (custom) return custom;
    }
    const b = (body ?? {}) as { content?: string; channel?: "cena" | "fora_de_cena"; title?: string; x?: number; y?: number; zoom?: number };

    if (method === "GET" && path === "/journeys/current/messages") {
      return jsonResponse({ mode: mode(), scene: openScene(), proposal: sc().proposal, messages: sc().messages });
    }
    if (method === "POST" && path === "/journeys/current/opening") {
      if (sc().messages.length) return fail(409, "abertura_existente", "Esta Jornada já tem abertura.");
      const scene = sceneOf(nextId());
      sc().scenes.push(scene);
      const m = message("cena", scene.id, "narrador", OPENING_TEXT);
      event("cena_aberta", scene.id, { title: scene.title, place_name: scene.place_name });
      return sseResponse([
        sse("start", { id: "g-open" }),
        sse("scene", { scene: { ...scene, id: null, status: "proposta" } }),
        sse("token", { text: OPENING_TEXT }),
        sse("done", { reason: "completed", mode: "em_cena", scene, message: m }),
      ]);
    }
    if (method === "POST" && path === "/journeys/current/messages") {
      if (!sc().messages.length) return fail(409, "abertura_pendente", "A Jornada ainda não tem abertura.");
      const open = openScene();
      const channel = b.channel ?? (open ? "cena" : "fora_de_cena");
      if (channel === "cena" && !open) return fail(409, "sem_cena_aberta", "Não há Cena aberta.");
      const sceneId = open?.id ?? null;
      message(channel, sceneId, "jogador", b.content ?? "");
      const reply = channel === "cena" ? "O Narrador responde." : "O Aduran responde.";
      const m = message(channel, sceneId, "narrador", reply);
      const events = [sse("start", { id: "g-send" }), sse("token", { text: reply })];
      if (options.propose && channel === "fora_de_cena" && !open) {
        sc().proposal = proposalOf(nextId());
        events.push(sse("proposal", { proposal: sc().proposal }));
      }
      events.push(sse("done", { reason: "completed", message: m, proposal: sc().proposal }));
      return sseResponse(events);
    }
    if (method === "POST" && (path === "/journeys/current/messages/regenerate" || path === "/journeys/current/messages/continue")) {
      const channel = b.channel ?? (openScene() ? "cena" : "fora_de_cena");
      const last = lastOfChannel(channel);
      if (!last || last.role !== "narrador") return fail(409, "sem_resposta_do_narrador", "A última mensagem não é do Narrador.");
      const regen = path.endsWith("regenerate");
      const text = regen ? "Outra versão." : "E continua.";
      last.content = regen ? text : `${last.content} ${text}`;
      last.status = "concluida";
      return sseResponse([sse("start", { id: "g-redo" }), sse("token", { text }), sse("done", { reason: "completed", message: last, replaced: regen })]);
    }
    if (method === "POST" && path === "/journeys/current/proposal/accept") {
      const p = sc().proposal;
      if (!p) return fail(409, "sem_proposta_pendente", "Não há proposta pendente.");
      if (openScene()) return fail(409, "cena_ja_aberta", "Já existe uma Cena aberta.");
      const scene = sceneOf(nextId(), { title: p.title, place_id: p.place.id, place_name: p.place.name, motive: p.motive, participants: p.participants });
      sc().scenes.push(scene);
      sc().proposal = null;
      const text = "A neblina sobe do porto.";
      const m = message("cena", scene.id, "narrador", text);
      event("lugar", scene.id, { place_name: p.place.name, new_place: p.place.kind === "novo" });
      event("cena_aberta", scene.id, { title: scene.title, place_name: scene.place_name });
      const current = { id: "j-1", name: p.place.name ?? "", type: p.place.type ?? "", description: p.place.description ?? "", source: "jornada" };
      return sseResponse([
        sse("start", { id: "g-accept" }),
        sse("scene", { scene: { ...scene, id: null, status: "proposta" }, proposal: p }),
        sse("token", { text }),
        sse("done", { reason: "completed", mode: "em_cena", scene, message: m, current_place: current, proposal: null }),
      ]);
    }
    if (method === "POST" && path === "/journeys/current/proposal/reroll") {
      if (!sc().proposal) return fail(409, "sem_proposta_pendente", "Não há proposta pendente.");
      sc().proposal = proposalOf(nextId(), {
        title: "Outra Cena",
        place: { kind: "conhecido", id: "lugar-1", name: WORLD.places[0]!.name, type: "estalagem", description: "" },
      });
      return jsonResponse({ proposal: sc().proposal });
    }
    if (method === "POST" && path === "/journeys/current/proposal/decline") {
      const declined = sc().proposal;
      if (!declined) return fail(409, "sem_proposta_pendente", "Não há proposta pendente.");
      sc().proposal = null;
      return jsonResponse({ proposal: null, declined: { ...declined, status: "recusada" } });
    }
    if (method === "POST" && path === "/journeys/current/scene/close") {
      const open = openScene();
      if (!open) return fail(409, "sem_cena_aberta", "Não há Cena aberta para encerrar.");
      open.status = "encerrada";
      open.summary = "Resumo da Cena.";
      open.closed_at = now;
      event("cena_encerrada", open.id, { title: open.title, summary: open.summary });
      return jsonResponse({ mode: "fora_de_cena", scene: open });
    }
    if (method === "GET" && path === "/journeys/current/arcs") {
      const ambition = state.open?.character?.ambition;
      const scenes = sc().scenes.map((s) => ({ id: s.id, title: s.title, day_period: s.day_period, place_name: s.place_name, status: s.status }));
      return jsonResponse({ arcs: [{ objective_id: ambition?.id ?? 1, text: ambition?.text ?? "Ambição", status: "ativo", scenes }] });
    }
    const sceneMatch = /^\/journeys\/current\/scenes\/(\d+)$/.exec(path);
    if (sceneMatch) {
      const scene = sc().scenes.find((s) => s.id === Number(sceneMatch[1]));
      if (!scene) return fail(404, "cena_nao_encontrada", "Cena não encontrada.");
      if (method === "PATCH") {
        const title = (b.title ?? "").trim();
        if (!title || title.length > 80) {
          return jsonResponse({ detail: { code: "titulo_invalido", message: "O título deve ter de 1 a 80 caracteres.", errors: [] } }, 422);
        }
        if (title !== scene.title) {
          event("cena_renomeada", scene.id, { title, previous_title: scene.title });
          scene.title = title;
        }
        return jsonResponse({ scene });
      }
      return jsonResponse({ scene, messages: sc().messages.filter((m) => m.channel === "cena" && m.scene_id === scene.id) });
    }
    if (method === "GET" && path === "/journeys/current/events") {
      const id = query.get("scene_id");
      return jsonResponse({ events: id ? sc().events.filter((e) => e.scene_id === Number(id)) : sc().events });
    }
    if (method === "GET" && path === "/journeys/current/places") {
      const first = WORLD.places[0]!;
      const places = WORLD.places.map((p, i) => ({ ...p, source: "mundo", scene_id: null, created_at: null, current: i === 0 }));
      return jsonResponse({ current_place_id: first.id, places, path: [{ place_id: first.id, name: first.name, scene_id: null, event_id: null, at: null }] });
    }
    if (path === "/journeys/current/portrait") {
      if (method === "PUT") {
        if (options.portraitError) {
          const e = options.portraitError;
          return fail(e.status, e.code, e.message);
        }
        sc().portrait = {
          crop: { x: Number(query.get("x")), y: Number(query.get("y")), zoom: Number(query.get("zoom")) },
          url_path: "/journeys/current/portrait",
        };
        return jsonResponse({ portrait: sc().portrait });
      }
      if (method === "PATCH") {
        if (!sc().portrait) return fail(404, "retrato_ausente", "Sem retrato.");
        sc().portrait = { crop: { x: b.x ?? 0.5, y: b.y ?? 0.5, zoom: b.zoom ?? 1 }, url_path: "/journeys/current/portrait" };
        return jsonResponse({ portrait: sc().portrait });
      }
      if (method === "DELETE") {
        sc().portrait = null;
        return jsonResponse({ portrait: null });
      }
      if (!sc().portrait) return fail(404, "retrato_ausente", "Sem retrato.");
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "Content-Type": "image/png" } });
    }
    return fail(404, "rota_desconhecida", `rota falsa desconhecida: ${method} ${path}`);
  };
}
