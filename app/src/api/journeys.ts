/**
 * Cliente tipado das rotas de regras, Mundos, personagem e Jornadas (backend/README.md, "API").
 *
 * A interface não duplica regras: Atributos, Perícias, distribuições, perfis, teto
 * e limites vêm de `GET /rules/creation` e `GET /worlds/schema`; a validação
 * definitiva é a do servidor. Erros chegam como `BackendError` (código, mensagem
 * e, nas validações, erros por campo).
 */
import { authHeaders, baseUrl, errorFromResponse, type BackendInfo, type FieldError } from "./backend";
import { request } from "./engine";

/* ------------------------------------------------------------------ regras */

export interface RuleCategory {
  id: string;
  name: string;
}

export interface RuleAttribute {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Ids das Perícias ligadas a este Atributo. */
  skills: string[];
}

export interface RuleSkill {
  id: string;
  name: string;
  attribute: string;
  description: string;
}

export interface SkillProfile {
  id: string;
  name: string;
  distribution: { value: number; count: number }[];
  total_skills: number;
}

export interface DerivedRule {
  id: string;
  name: string;
  base: number;
  attribute: string;
  formula: string;
}

export interface CreationRules {
  rules_version: string;
  categories: RuleCategory[];
  attributes: RuleAttribute[];
  skills: RuleSkill[];
  attribute_distribution: number[];
  skill_profiles: SkillProfile[];
  creation_max: number;
  ranges: { attribute: { min: number; max: number }; skill: { min: number; max: number } };
  derived: DerivedRule[];
  convictions: { count: number };
  text_limits: Record<string, number>;
  fields: string[];
}

/* ------------------------------------------------------------------- Mundo */

export interface Range {
  min: number;
  max: number;
}

export interface WorldSchema {
  schema: number;
  content_max_bytes: number;
  seed_max: number;
  name_max: number;
  description_max: number;
  short_name_max: number;
  domain_max: number;
  year: Range;
  months: Range;
  month_days: Range;
  weekdays: Range;
  religions: Range;
  places: Range;
  place_id_pattern: string;
}

export interface NamedText {
  name: string;
  description: string;
}

export interface WorldMonth {
  name: string;
  /** `null` enquanto o campo está vazio na edição. */
  days: number | null;
}

export interface WorldCalendar {
  name: string;
  year: number | null;
  era_label: string;
  months: WorldMonth[];
  weekdays: string[];
}

export interface WorldReligion {
  name: string;
  domain: string;
  description: string;
}

export interface WorldPlace {
  id: string;
  name: string;
  type: string;
  description: string;
}

/** Conteúdo de Mundo, esquema v1. */
export interface WorldContent {
  schema: number;
  name: string;
  era: NamedText;
  tone: NamedText;
  calendar: WorldCalendar;
  religions: WorldReligion[];
  places: WorldPlace[];
}

export interface WorldValidation {
  valid: boolean;
  errors: FieldError[];
  content: WorldContent | null;
}

/* -------------------------------------------------------------- personagem */

export interface ConvictionDraft {
  text: string;
  pillar: string;
}

/** Rascunho enviado ao servidor (`POST /characters/validate` e `POST /journeys`). */
export interface CharacterDraft {
  name: string;
  concept: string;
  appearance: string;
  history: string;
  ambition: string;
  desire: string;
  convictions: ConvictionDraft[];
  attributes: Record<string, number>;
  skill_profile?: string;
  skills: Record<string, number>;
  /** Descrição opcional, sem efeito de regra (limites em `text_limits`). Vazio ou ausente = não informado. */
  age?: string;
  height?: string;
  origin?: string;
  personality?: string;
  /**
   * História formatada (HTML do editor; ADR-077). O servidor sanea, deriva o texto puro e o usa
   * como `history` (o limite de `text_limits.history` conta o texto puro). Ausente = `history` em texto simples.
   */
  history_html?: string;
}

export interface DerivedPreview {
  [id: string]: number | null;
}

export interface CharacterValidation {
  valid: boolean;
  errors: FieldError[];
  derived: DerivedPreview;
}

/* ---------------------------------------------------------------- Jornadas */

export type JourneyStatus = "ok" | "danificada" | "mais_nova" | "sem_mundo";

export interface JourneySummary {
  id: string;
  name: string | null;
  character_name: string | null;
  location: string | null;
  day_period: string | null;
  world_id: string | null;
  world_version: number | null;
  world_name: string | null;
  created_at: string | null;
  last_saved_at: string | null;
  schema_version: number;
  status: JourneyStatus;
  error_code: string | null;
  error_message: string | null;
  rules_version: string | null;
  /** Cartão "Última Jornada" do menu (só com `status` `ok`; ausentes em respostas antigas). */
  calendar?: CalendarDate | null;
  /** Título da Cena em andamento; `null` Fora de Cena. */
  current_scene_title?: string | null;
  /** Retrato servido sem abrir a Jornada (`url_path` = `/journeys/<id>/portrait`). */
  portrait?: PortraitInfo | null;
  /** Descrição da Jornada (ADR-077, item 4); `null` sem descrição; ausente em respostas antigas. */
  description?: string | null;
}

export interface JourneyList {
  journeys: JourneySummary[];
  last_journey_id: string | null;
}

export interface Track {
  size: number | null;
  superficial: number;
  agravada: number;
}

export interface Objective {
  id: number;
  text: string;
  created_at: string;
}

export interface SheetConviction {
  position: number;
  text: string;
  pillar: string;
  fractures: number;
}

/** Enquadramento do retrato: centro (`x`, `y`, de 0 a 1) e aproximação (`zoom`, de 1 a 8). */
export interface PortraitCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface PortraitInfo {
  crop: PortraitCrop;
  /** Rota da imagem original (exige o token: buscar com `fetch`, não com `<img src>`). */
  url_path: string;
}

export interface CharacterSheet {
  name: string;
  concept: string;
  appearance: string;
  /** Texto puro da História. */
  history: string;
  /** História formatada (HTML saneado pelo serviço; parágrafos nas Histórias antigas). */
  history_html?: string | null;
  /** Campos opcionais da descrição (nulos quando não informados; ausentes em Jornadas antigas). */
  age?: string | null;
  height?: string | null;
  origin?: string | null;
  personality?: string | null;
  portrait?: PortraitInfo | null;
  skill_profile: string;
  created_at: string;
  attributes: Record<string, number>;
  skills: Record<string, number>;
  convictions: SheetConviction[];
  ambition: Objective | null;
  desire: Objective | null;
  tracks: Record<string, Track>;
  derived: Record<string, number | null>;
  rules_version: string | null;
}

/** Resumo da Jornada aberta (`journey_meta`). */
export interface OpenJourneySummary {
  id: string;
  name: string | null;
  character_name: string | null;
  location: string | null;
  day_period: string | null;
  world_id: string | null;
  world_version: number | null;
  created_at: string | null;
  last_saved_at: string | null;
  rules_version: string | null;
  start_place_id?: string | null;
  current_place_id?: string | null;
  calendar_year?: number | null;
  calendar_month?: number | null;
  calendar_day?: number | null;
  /** Descrição da Jornada (ADR-077, item 4). */
  description?: string | null;
}

/* ------------------------------------------------- Cena, proposta e lugar */

export type JourneyMode = "fora_de_cena" | "em_cena";
export type MessageChannel = "fora_de_cena" | "cena";

/** Cena como a API entrega (`status` `proposta` só durante a abertura ou o aceite). */
export interface SceneView {
  id: number | null;
  status: "proposta" | "aberta" | "encerrada" | string;
  title: string | null;
  opening_tone: string | null;
  place_id: string | null;
  place_name: string | null;
  day_period: string | null;
  motive: string | null;
  participants: string[];
  objective_id: number | null;
  summary: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

export interface ProposalPlace {
  kind: "conhecido" | "novo";
  id: string | null;
  name: string | null;
  type: string | null;
  description: string | null;
}

export interface SceneProposal {
  id: number;
  status: string;
  title: string | null;
  place: ProposalPlace;
  motive: string | null;
  participants: string[];
  created_at: string | null;
}

export interface CurrentPlace {
  id: string;
  name: string;
  type: string;
  description: string;
  source: "mundo" | "jornada";
}

/** Data no calendário do Mundo (ADR-076, item 16). */
export interface CalendarDate {
  year: number;
  month: number;
  month_name: string;
  day: number;
  weekday: number;
  weekday_name: string;
  era_label: string;
}

/** O que `GET /journeys/current` e `POST /journeys/{id}/open` devolvem. */
export interface JourneySnapshot {
  journey: OpenJourneySummary;
  character: CharacterSheet | null;
  world: { id: string; version: number; content: WorldContent | null };
  /** Campos da tela da Jornada (ausentes em respostas antigas). */
  mode?: JourneyMode;
  scene?: SceneView | null;
  proposal?: SceneProposal | null;
  current_place?: CurrentPlace | null;
  calendar?: CalendarDate | null;
}

export interface BackupInfo {
  name: string;
  schema_version: number;
  /** `AAAAMMDD-HHMMSS`, hora local, do nome do arquivo. */
  created: string;
  size_bytes: number;
}

/** Jornada excluída; o Mundo dela continua salvo (só a tela de Mundos o exclui). */
export interface JourneyDeletion {
  deleted: string;
  world_id: string | null;
}

/** Mundo salvo, na lista da Nova Jornada (`GET /worlds`). */
export interface SavedWorld {
  id: string;
  name: string | null;
  created_at: string | null;
  versions: number[];
  latest_version: number | null;
  schema_version: number;
  status: "ok" | "danificado" | "mais_novo" | string;
  error_code: string | null;
  error_message: string | null;
  /** Semente do Mundo; `null` em Mundos antigos e nos personalizados (editados, criados do zero ou duplicados). */
  seed: number | null;
  /** Nome da era e do tom da última versão. */
  era: string | null;
  tone: string | null;
  /** Quantas Jornadas usam o Mundo. */
  journey_count: number | null;
}

/** Mundo novo (conteúdo e, se gerado sem edição, a semente) ou Mundo salvo (id), lido sem alteração. */
export type NewJourneyWorld = { content: WorldContent; seed?: number } | { id: string };

export interface NewJourneyBody {
  name?: string;
  /** Descrição da Jornada (opcional, até 2.000 caracteres). */
  description?: string;
  world: NewJourneyWorld;
  start_place_id: string;
  character: CharacterDraft;
}

/* ------------------------------------------------------------------- rotas */

const journeyPath = (id: string) => `/journeys/${encodeURIComponent(id)}`;

export const fetchCreationRules = (info: BackendInfo) => request<CreationRules>(info, "/rules/creation");
export const fetchWorldSchema = (info: BackendInfo) => request<WorldSchema>(info, "/worlds/schema");

export const generateWorld = (info: BackendInfo, seed?: number) =>
  request<{ seed: number; content: WorldContent }>(info, "/worlds/generate", {
    method: "POST",
    body: seed === undefined ? {} : { seed },
  });

export const listWorlds = (info: BackendInfo) => request<{ worlds: SavedWorld[] }>(info, "/worlds");

export const fetchWorld = (info: BackendInfo, id: string) =>
  request<{ world: SavedWorld; content: WorldContent | null }>(info, `/worlds/${encodeURIComponent(id)}`);

/** Salva um Mundo sem Jornada (tela de Mundos); a semente só fica se reproduz o conteúdo. */
export const saveWorld = (info: BackendInfo, content: WorldContent, seed?: number | null) =>
  request<{ world: SavedWorld }>(info, "/worlds", {
    method: "POST",
    body: seed == null ? { content } : { content, seed },
  });

/** Exclui um Mundo salvo; 409 `mundo_em_uso` se alguma Jornada o usa. */
export const deleteWorld = (info: BackendInfo, id: string) =>
  request<{ deleted: string }>(info, `/worlds/${encodeURIComponent(id)}?confirm=true`, { method: "DELETE" });

export const validateWorld = (info: BackendInfo, content: WorldContent) =>
  request<WorldValidation>(info, "/worlds/validate", { method: "POST", body: { content } });

export const validateCharacter = (info: BackendInfo, draft: CharacterDraft) =>
  request<CharacterValidation>(info, "/characters/validate", { method: "POST", body: { draft } });

export const createJourney = (info: BackendInfo, body: NewJourneyBody) =>
  request<{ journey: JourneySummary }>(info, "/journeys", { method: "POST", body });

export const listJourneys = (info: BackendInfo) => request<JourneyList>(info, "/journeys");
export const fetchCurrentJourney = (info: BackendInfo) => request<JourneySnapshot>(info, "/journeys/current");

export const openJourney = (info: BackendInfo, id: string) =>
  request<JourneySnapshot>(info, `${journeyPath(id)}/open`, { method: "POST" });

export const closeJourney = (info: BackendInfo) =>
  request<{ closed: string | null }>(info, "/journeys/close", { method: "POST" });

export const deleteJourney = (info: BackendInfo, id: string) =>
  request<JourneyDeletion>(info, `${journeyPath(id)}?confirm=true`, { method: "DELETE" });

export const listBackups = (info: BackendInfo, id: string) =>
  request<{ backups: BackupInfo[] }>(info, `${journeyPath(id)}/backups`);

export interface ReturnPoint {
  id: string;
  name: string;
  kind: "manual" | "automatic";
  location: string | null;
  message_count: number;
  created_at: string;
}

const pointsPath = (id: string, pid?: string) => `${journeyPath(id)}/return-points${pid ? `/${encodeURIComponent(pid)}` : ""}`;
export const listReturnPoints = (info: BackendInfo, id: string) =>
  request<{ points: ReturnPoint[] }>(info, pointsPath(id));
export const saveReturnPoint = (info: BackendInfo, id: string, name?: string) =>
  request<{ point: ReturnPoint }>(info, pointsPath(id), { method: "POST", body: { name } });
export const renameReturnPoint = (info: BackendInfo, id: string, pid: string, name: string) =>
  request<{ point: ReturnPoint }>(info, pointsPath(id, pid), { method: "PATCH", body: { name } });
export const replaceReturnPoint = (info: BackendInfo, id: string, pid: string) =>
  request<{ point: ReturnPoint }>(info, `${pointsPath(id, pid)}?confirm=true`, { method: "PUT" });
export const deleteReturnPoint = (info: BackendInfo, id: string, pid: string) =>
  request<{ deleted: string }>(info, `${pointsPath(id, pid)}?confirm=true`, { method: "DELETE" });
export const loadReturnPoint = (info: BackendInfo, id: string, pid: string) =>
  request<JourneySnapshot>(info, `${pointsPath(id, pid)}/load?confirm=true`, { method: "POST" });

/**
 * Imagem de um retrato pela rota do serviço (`portrait.url_path`); exige o token, por
 * isso não vai direto num `<img src>`. `null` sem retrato (404).
 */
export async function fetchPortraitAt(info: BackendInfo, urlPath: string, signal?: AbortSignal): Promise<Blob | null> {
  if (!urlPath.startsWith("/journeys/")) return null;
  const init: RequestInit = { headers: authHeaders(info) };
  if (signal) init.signal = signal;
  const response = await fetch(`${baseUrl(info)}${urlPath}`, init);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFromResponse(response);
  return response.blob();
}

export const restoreBackup = (info: BackendInfo, id: string, backup: string) =>
  request<{ restored_from: string; preserved_as: string | null }>(info, `${journeyPath(id)}/restore`, {
    method: "POST",
    body: { backup },
  });
