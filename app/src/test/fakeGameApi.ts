/**
 * Serviço falso das rotas de regras, Mundos e Jornadas, para os testes da interface.
 * Imita os formatos de backend/README.md; a validação é simplificada (só o necessário
 * para os testes), porque a definitiva é a do servidor.
 */
import type { FieldError } from "../api/backend";
import type {
  BackupInfo,
  CharacterDraft,
  CharacterSheet,
  JourneySnapshot,
  JourneySummary,
  SavedWorld,
  WorldContent,
} from "../api/journeys";
import { jsonResponse, sse, sseResponse } from "./fakeFetch";
import { CALENDAR, createScreenHandler, initialScreen, type FakeScreenOptions } from "./fakeJourneyScreen";
import { RULES, VALID_DRAFT, WORLD, WORLD_SCHEMA, WORLD_SEED } from "./gameData";

export const JOURNEY_ID = "11111111-1111-4111-8111-111111111111";
export const WORLD_ID = "22222222-2222-4222-8222-222222222222";

export function summary(patch: Partial<JourneySummary> = {}): JourneySummary {
  return {
    id: JOURNEY_ID,
    name: "O Selo de Elmora",
    character_name: "Ilsa Corvalho",
    location: WORLD.places[0]!.name,
    day_period: "noite",
    world_id: WORLD_ID,
    world_version: 1,
    world_name: WORLD.name,
    created_at: "2026-11-20T10:00:00+00:00",
    last_saved_at: "2026-11-20T14:27:00+00:00",
    schema_version: 2,
    status: "ok",
    error_code: null,
    error_message: null,
    rules_version: "fatia-1",
    ...patch,
  };
}

export function sheet(draft: CharacterDraft = VALID_DRAFT): CharacterSheet {
  const attributes = Object.fromEntries(RULES.attributes.map((a) => [a.id, draft.attributes[a.id] ?? 1]));
  const skills = Object.fromEntries(RULES.skills.map((s) => [s.id, draft.skills[s.id] ?? 0]));
  const tracks = Object.fromEntries(
    RULES.derived.map((d) => [d.id, { size: d.base + (attributes[d.attribute] ?? 0), superficial: 0, agravada: 0 }]),
  );
  return {
    name: draft.name,
    concept: draft.concept,
    appearance: draft.appearance,
    history: draft.history,
    skill_profile: draft.skill_profile ?? "equilibrado",
    created_at: "2026-11-20T10:00:00+00:00",
    attributes,
    skills,
    convictions: draft.convictions.map((c, i) => ({ position: i + 1, text: c.text, pillar: c.pillar, fractures: 0 })),
    ambition: { id: 1, text: draft.ambition, created_at: "2026-11-20T10:00:00+00:00" },
    desire: { id: 2, text: draft.desire, created_at: "2026-11-20T10:00:00+00:00" },
    tracks,
    derived: Object.fromEntries(Object.entries(tracks).map(([k, v]) => [k, v.size])),
    rules_version: "fatia-1",
  };
}

export function snapshotOf(j: JourneySummary, character: CharacterSheet = sheet()): JourneySnapshot {
  const place = WORLD.places[0]!;
  return {
    mode: "fora_de_cena",
    scene: null,
    proposal: null,
    current_place: { id: place.id, name: place.name, type: place.type, description: place.description, source: "mundo" },
    calendar: CALENDAR,
    journey: {
      id: j.id,
      name: j.name,
      character_name: j.character_name,
      location: j.location,
      day_period: j.day_period,
      world_id: j.world_id,
      world_version: j.world_version,
      created_at: j.created_at,
      last_saved_at: j.last_saved_at,
      rules_version: j.rules_version,
    },
    character,
    world: { id: j.world_id ?? WORLD_ID, version: 1, content: WORLD },
  };
}

const LABELS: Record<string, string> = {
  name: "O nome",
  concept: "O Conceito",
  history: "A história",
  ambition: "A Ambição",
  desire: "O Desejo",
};

/** Validação simplificada do rascunho, com os mesmos caminhos de erro do servidor. */
export function fakeValidateCharacter(draft: CharacterDraft): { valid: boolean; errors: FieldError[]; derived: Record<string, number | null> } {
  const errors: FieldError[] = [];
  for (const key of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    const value = (draft as unknown as Record<string, string>)[key] ?? "";
    if (!value.trim()) errors.push({ field: key, code: "obrigatorio", message: `${LABELS[key]} é obrigatório(a).` });
  }
  draft.convictions.forEach((c, i) => {
    if (!c.text.trim()) errors.push({ field: `convictions[${i}].text`, code: "obrigatorio", message: "A Convicção é obrigatório(a)." });
    if (!c.pillar.trim()) errors.push({ field: `convictions[${i}].pillar`, code: "obrigatorio", message: "O Pilar é obrigatório(a)." });
  });
  let attrsOk = true;
  for (const a of RULES.attributes) {
    if (draft.attributes[a.id] === undefined) {
      attrsOk = false;
      errors.push({ field: `attributes.${a.id}`, code: "atributo_ausente", message: `Falta o valor de ${a.name}.` });
    }
  }
  const sorted = (v: number[]) => [...v].sort((x, y) => y - x).join(",");
  if (attrsOk && sorted(Object.values(draft.attributes)) !== sorted(RULES.attribute_distribution)) {
    errors.push({ field: "attributes", code: "distribuicao_invalida", message: "Os Atributos não seguem a distribuição." });
  }
  const profile = RULES.skill_profiles.find((p) => p.id === draft.skill_profile);
  if (!draft.skill_profile) errors.push({ field: "skill_profile", code: "obrigatorio", message: "Escolha um perfil de Perícias." });
  else if (profile) {
    const expected = sorted(profile.distribution.flatMap((d) => Array.from({ length: d.count }, () => d.value)));
    if (sorted(Object.values(draft.skills).filter((v) => v > 0)) !== expected) {
      errors.push({ field: "skills", code: "distribuicao_invalida", message: `O perfil ${profile.name} pede outra distribuição.` });
    }
  }
  const derived = Object.fromEntries(
    RULES.derived.map((d) => {
      const v = draft.attributes[d.attribute];
      return [d.id, typeof v === "number" ? d.base + v : null];
    }),
  );
  return { valid: errors.length === 0, errors, derived };
}

/** Validação simplificada do Mundo. */
export function fakeValidateWorld(content: WorldContent): { valid: boolean; errors: FieldError[]; content: WorldContent | null } {
  const errors: FieldError[] = [];
  if (!content.name.trim()) errors.push({ field: "name", code: "obrigatorio", message: "O nome do Mundo é obrigatório(a)." });
  content.calendar.months.forEach((m, i) => {
    if (!m.name.trim()) errors.push({ field: `calendar.months[${i}].name`, code: "obrigatorio", message: "O nome do mês é obrigatório(a)." });
    if (m.days === null || m.days < WORLD_SCHEMA.month_days.min || m.days > WORLD_SCHEMA.month_days.max) {
      errors.push({ field: `calendar.months[${i}].days`, code: "fora_do_intervalo", message: "Um mês tem de 20 a 40 dias." });
    }
  });
  content.places.forEach((p, i) => {
    if (!p.name.trim()) errors.push({ field: `places[${i}].name`, code: "obrigatorio", message: "O nome do lugar é obrigatório(a)." });
  });
  return { valid: errors.length === 0, errors, content: errors.length ? null : content };
}

/** Mundo salvo de exemplo (`GET /worlds`), com o conteúdo de `GET /worlds/{id}`. */
export function savedWorld(patch: Partial<SavedWorld> = {}, content: WorldContent = WORLD): { world: SavedWorld; content: WorldContent } {
  return {
    world: {
      id: WORLD_ID,
      name: content.name,
      created_at: "2026-11-20T10:00:00+00:00",
      versions: [1],
      latest_version: 1,
      schema_version: 2,
      status: "ok",
      error_code: null,
      error_message: null,
      seed: WORLD_SEED,
      era: content.era.name,
      tone: content.tone.name,
      journey_count: 1,
      ...patch,
    },
    content,
  };
}

export interface FakeGameOptions extends FakeScreenOptions {
  /** Mundos salvos (`GET /worlds` e `GET /worlds/{id}`). */
  savedWorlds?: { world: SavedWorld; content: WorldContent }[];
  /** Erro de `GET /worlds`. */
  worldsError?: boolean;
  journeys?: JourneySummary[];
  lastJourneyId?: string | null;
  backups?: BackupInfo[];
  /** Erro devolvido ao abrir (código e status). */
  openError?: { status: number; code: string; message: string };
  /** Resposta de `POST /journeys` (padrão: 201 com uma Jornada nova). */
  createResponse?: () => Response;
  /** Resposta de `POST /narrator/fill` (padrão: um resultado válido de teste para o pedido). */
  fillResponse?: (body: FillBody, init: RequestInit) => Response | Promise<Response>;
}

/** Corpo de `POST /narrator/fill` (o que os testes conferem). */
export interface FillBody {
  kind: string;
  field?: string;
  tab?: string;
  mode?: string;
  idea?: string;
  world?: Record<string, string>;
  character?: CharacterDraft;
  journey?: { name?: string; description?: string };
}

const FILL_TABS: Record<string, string[]> = {
  ident: ["name", "concept", "appearance"],
  obj: ["ambition", "desire", "convictions[0].text", "convictions[0].pillar", "convictions[1].text", "convictions[1].pillar", "convictions[2].text", "convictions[2].pillar"],
};

/** Resultado de teste do Narrador que preenche dados (o serviço real valida e propõe). */
export function fakeFillResult(body: FillBody): Record<string, unknown> {
  const draft = body.character;
  const textOf = (path: string): string => {
    const m = /^convictions\[(\d+)\]\.(text|pillar)$/.exec(path);
    if (m) return draft?.convictions[Number(m[1])]?.[m[2] as "text" | "pillar"] ?? "";
    return ((draft as unknown as Record<string, string> | undefined)?.[path] ?? "") as string;
  };
  if (body.kind === "field") return { values: { [body.field!]: `Sugestão para ${body.field}` } };
  if (body.kind === "missing") {
    const blank = (FILL_TABS[body.tab ?? ""] ?? []).filter((p) => !textOf(p).trim());
    return { values: Object.fromEntries(blank.map((p) => [p, `Sugestão para ${p}`])) };
  }
  if (body.kind === "attributes") return { attributes: { ...VALID_DRAFT.attributes, ...(draft?.attributes ?? {}) } };
  if (body.kind === "skills") return { skill_profile: VALID_DRAFT.skill_profile, skills: { ...VALID_DRAFT.skills } };
  return { history_html: "<h3>Origens</h3><p>Narrada pelo Narrador.</p>", history: "Origens\nNarrada pelo Narrador." };
}

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** Roteador falso. `handle` devolve `undefined` para rotas que não são dele. */
export function createFakeGameApi(options: FakeGameOptions = {}) {
  const state = {
    journeys: [...(options.journeys ?? [])],
    lastJourneyId: options.lastJourneyId ?? null,
    open: null as JourneySnapshot | null,
    worlds: new Set<string>(options.journeys?.map((j) => j.world_id ?? "") ?? []),
    generated: 0,
    savedWorlds: [...(options.savedWorlds ?? [])],
    screen: initialScreen(options),
  };
  const calls: Call[] = [];
  const screenHandler = createScreenHandler(state, options);

  const handle = (url: string, init: RequestInit = {}): Response | Promise<Response> | undefined => {
    const method = (init.method ?? "GET").toUpperCase();
    const parsed = new URL(url);
    const path = parsed.pathname;
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    const record = () => calls.push({ method, path: path + parsed.search, body });

    if (method === "GET" && path === "/rules/creation") return jsonResponse(RULES);
    if (method === "GET" && path === "/worlds/schema") return jsonResponse(WORLD_SCHEMA);
    if (method === "POST" && path === "/worlds/generate") {
      record();
      state.generated++;
      const seed = (body as { seed?: number } | undefined)?.seed ?? WORLD_SEED;
      const content = JSON.parse(JSON.stringify(WORLD)) as WorldContent;
      content.name = `${WORLD.name} ${seed}`;
      return jsonResponse({ seed, content });
    }
    if (method === "GET" && path === "/worlds") {
      if (options.worldsError) return jsonResponse({ detail: { code: "storage_unavailable", message: "Indisponível." } }, 503);
      return jsonResponse({ worlds: state.savedWorlds.map((w) => w.world) });
    }
    if (method === "POST" && path === "/worlds") {
      record();
      const b = body as { content: WorldContent; seed?: number };
      const check = fakeValidateWorld(b.content);
      if (!check.valid) {
        const errors = check.errors.map((e) => ({ ...e, field: `content.${e.field}` }));
        return jsonResponse({ detail: { code: "mundo_invalido", message: "O Mundo tem erros; nada foi salvo.", errors } }, 422);
      }
      const id = `44444444-4444-4444-8444-${String(state.savedWorlds.length + 1).padStart(12, "0")}`;
      const item = savedWorld({ id, journey_count: 0, seed: b.seed ?? null }, b.content);
      state.savedWorlds.push(item);
      return jsonResponse({ world: item.world }, 201);
    }
    const worldRoute = /^\/worlds\/([^/]+)$/.exec(path);
    if (method === "GET" && worldRoute && worldRoute[1] !== "schema") {
      record();
      const found = state.savedWorlds.find((w) => w.world.id === decodeURIComponent(worldRoute[1]!));
      if (!found) return jsonResponse({ detail: { code: "mundo_nao_encontrado", message: "Mundo não encontrado." } }, 404);
      return jsonResponse({ world: found.world, content: found.content });
    }
    if (method === "DELETE" && worldRoute) {
      record();
      const wid = decodeURIComponent(worldRoute[1]!);
      const found = state.savedWorlds.find((w) => w.world.id === wid);
      if (!found) return jsonResponse({ detail: { code: "mundo_nao_encontrado", message: "Mundo não encontrado." } }, 404);
      if ((found.world.journey_count ?? 0) > 0) {
        return jsonResponse({ detail: { code: "mundo_em_uso", message: "O Mundo é usado por 1 Jornada(s); exclua-as antes." } }, 409);
      }
      state.savedWorlds = state.savedWorlds.filter((w) => w.world.id !== wid);
      return jsonResponse({ deleted: wid });
    }
    if (method === "POST" && path === "/narrator/fill") {
      record();
      const b = body as FillBody;
      if (options.fillResponse) return options.fillResponse(b, init);
      return sseResponse([sse("start", { id: "g-fill" }), sse("done", { reason: "completed", kind: b.kind, result: fakeFillResult(b) })]);
    }
    if (method === "POST" && path === "/worlds/validate") {
      return jsonResponse(fakeValidateWorld((body as { content: WorldContent }).content));
    }
    if (method === "POST" && path === "/characters/validate") {
      return jsonResponse(fakeValidateCharacter((body as { draft: CharacterDraft }).draft));
    }
    if (method === "GET" && path === "/journeys") {
      return jsonResponse({ journeys: state.journeys, last_journey_id: state.lastJourneyId });
    }
    if (method === "POST" && path === "/journeys") {
      record();
      if (options.createResponse) return options.createResponse();
      const b = body as { name?: string; description?: string; character: CharacterDraft; start_place_id: string; world: { id?: string } };
      const created = summary({
        id: "33333333-3333-4333-8333-333333333333",
        name: b.name ?? `A Jornada de ${b.character.name}`,
        character_name: b.character.name,
        day_period: "amanhecer",
        world_id: b.world.id ?? WORLD_ID,
        description: b.description ?? null,
      });
      state.journeys.unshift(created);
      return jsonResponse({ journey: created }, 201);
    }
    if (path.startsWith("/journeys/current/")) {
      record();
      return screenHandler(method, path, parsed.searchParams, body, init);
    }
    if (method === "PATCH" && path === "/journeys/current") {
      record();
      if (!state.open) return jsonResponse({ detail: { code: "nenhuma_jornada_aberta", message: "Nenhuma Jornada está aberta." } }, 404);
      const b = body as { name?: string | null; description?: string | null };
      if (typeof b.name === "string" && b.name.trim().length > 200) {
        const errors = [{ field: "name", code: "muito_longo", message: "O nome da Jornada deve ter até 200 caracteres." }];
        return jsonResponse({ detail: { code: "resumo_invalido", message: "O nome ou a descrição da Jornada têm erros; nada mudou.", errors } }, 422);
      }
      const j = { ...state.open.journey };
      if ("name" in b) j.name = b.name?.trim() ? b.name.trim() : `A Jornada de ${state.open.character?.name ?? "seu personagem"}`;
      if ("description" in b) j.description = b.description?.trim() ? b.description.trim() : null;
      state.open = { ...state.open, journey: j };
      state.journeys = state.journeys.map((x) => (x.id === j.id ? { ...x, name: j.name } : x));
      return jsonResponse({ journey: j });
    }
    if (method === "GET" && path === "/journeys/current") {
      return state.open ? jsonResponse(state.open) : jsonResponse({ detail: { code: "nenhuma_jornada_aberta", message: "Nenhuma Jornada está aberta." } }, 404);
    }
    if (method === "POST" && path === "/journeys/close") {
      record();
      const closed = state.open?.journey.id ?? null;
      state.open = null;
      return jsonResponse({ closed });
    }
    const m = /^\/journeys\/([^/]+)(\/open|\/backups|\/restore|\/portrait)?$/.exec(path);
    if (m) {
      const id = decodeURIComponent(m[1]!);
      const journey = state.journeys.find((j) => j.id === id);
      record();
      if (!journey) return jsonResponse({ detail: { code: "jornada_nao_encontrada", message: "Jornada não encontrada." } }, 404);
      if (m[2] === "/open" && method === "POST") {
        if (options.openError) {
          const e = options.openError;
          return jsonResponse({ detail: { code: e.code, message: e.message } }, e.status);
        }
        state.open = snapshotOf(journey);
        state.lastJourneyId = id;
        return jsonResponse(state.open);
      }
      if (m[2] === "/backups") return jsonResponse({ backups: options.backups ?? [] });
      if (m[2] === "/portrait" && method === "GET") {
        if (!journey.portrait) return jsonResponse({ detail: { code: "retrato_ausente", message: "O personagem não tem retrato." } }, 404);
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { status: 200, headers: { "Content-Type": "image/png" } });
      }
      if (m[2] === "/restore" && method === "POST") {
        const name = (body as { backup: string }).backup;
        journey.status = "ok";
        return jsonResponse({ restored_from: name, preserved_as: "journey.db.danificado-20261123-101010" });
      }
      if (!m[2] && method === "DELETE") {
        state.journeys = state.journeys.filter((j) => j.id !== id);
        if (state.lastJourneyId === id) state.lastJourneyId = null;
        return jsonResponse({ deleted: id, world_id: journey.world_id });
      }
    }
    return undefined;
  };

  return { handle, state, calls };
}
