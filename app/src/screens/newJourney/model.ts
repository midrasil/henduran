/**
 * Estado do assistente de Nova Jornada e funções puras sobre ele.
 *
 * Nenhum número de regra mora aqui: distribuições, perfis e limites vêm do
 * catálogo (`GET /rules/creation`) e do esquema do Mundo (`GET /worlds/schema`).
 */
import type { FieldError } from "../../api/backend";
import type { CharacterDraft, CreationRules, SkillProfile, WorldContent, WorldPlace, WorldSchema } from "../../api/journeys";
import { countValues } from "../../lib/format";

/* ---------------------------------------------------------------- personagem */

export interface CharacterForm {
  name: string;
  concept: string;
  appearance: string;
  /** História formatada, em HTML do editor (o servidor sanea e deriva o texto puro). */
  history: string;
  ambition: string;
  desire: string;
  convictions: { text: string; pillar: string }[];
  /** `null` enquanto o Atributo não recebeu valor. */
  attributes: Record<string, number | null>;
  skill_profile: string | null;
  /** Perícias com valor; as ausentes valem 0. */
  skills: Record<string, number>;
  /** Descrição opcional, sem efeito de regra (vazio = não informado). */
  age: string;
  height: string;
  origin: string;
  personality: string;
}

/** Campos opcionais da descrição, na ordem do formulário. */
export const OPTIONAL_FIELDS = ["age", "height", "origin", "personality"] as const;
export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export function emptyCharacter(rules: CreationRules): CharacterForm {
  return {
    name: "",
    concept: "",
    appearance: "",
    history: "",
    ambition: "",
    desire: "",
    convictions: Array.from({ length: rules.convictions.count }, () => ({ text: "", pillar: "" })),
    attributes: Object.fromEntries(rules.attributes.map((a) => [a.id, null])),
    skill_profile: null,
    skills: {},
    age: "",
    height: "",
    origin: "",
    personality: "",
  };
}

/** Rascunho no formato do servidor: só Atributos com valor e Perícias acima de 0. */
export function toDraft(form: CharacterForm): CharacterDraft {
  const attributes: Record<string, number> = {};
  for (const [id, v] of Object.entries(form.attributes)) if (v !== null) attributes[id] = v;
  const skills: Record<string, number> = {};
  for (const [id, v] of Object.entries(form.skills)) if (v > 0) skills[id] = v;
  const draft: CharacterDraft = {
    name: form.name,
    concept: form.concept,
    appearance: form.appearance,
    // O servidor usa o HTML (saneado) e deriva o texto puro; o texto vai junto para clientes antigos.
    history: plainTextOfHtml(form.history),
    history_html: form.history,
    ambition: form.ambition,
    desire: form.desire,
    convictions: form.convictions.map((c) => ({ text: c.text, pillar: c.pillar })),
    attributes,
    skills,
  };
  if (form.skill_profile !== null) draft.skill_profile = form.skill_profile;
  // Opcionais: só vão quando preenchidos (o servidor trata vazio como não informado).
  for (const key of OPTIONAL_FIELDS) {
    if (form[key].trim()) draft[key] = form[key];
  }
  return draft;
}

/** Nome padrão sugerido para a Jornada (o servidor usa o mesmo quando o nome fica em branco). */
export const defaultJourneyName = (characterName: string) => `A Jornada de ${characterName.trim() || "seu personagem"}`;

/** O jogador já escreveu ou escolheu algo no personagem? */
export function characterTouched(form: CharacterForm): boolean {
  const texts = [
    form.name,
    form.concept,
    form.appearance,
    plainTextOfHtml(form.history),
    form.ambition,
    form.desire,
    ...OPTIONAL_FIELDS.map((k) => form[k]),
  ];
  return (
    texts.some((t) => t.trim() !== "") ||
    form.convictions.some((c) => c.text.trim() !== "" || c.pillar.trim() !== "") ||
    Object.values(form.attributes).some((v) => v !== null) ||
    form.skill_profile !== null ||
    Object.values(form.skills).some((v) => v > 0)
  );
}

/** Valores distintos, do maior para o menor. */
export const distinctDesc = (values: number[]) => [...new Set(values)].sort((a, b) => b - a);

export interface CountStatus {
  value: number;
  /** Quantos a distribuição pede. */
  expected: number;
  /** Quantos já foram usados. */
  used: number;
}

/** Para cada valor da distribuição: quantos pede e quantos foram usados (valores fora dela também aparecem). */
export function countStatus(expected: { value: number; count: number }[], used: number[]): CountStatus[] {
  const usedCounts = countValues(used);
  const values = distinctDesc([...expected.map((e) => e.value), ...usedCounts.keys()]);
  return values.map((value) => ({
    value,
    expected: expected.find((e) => e.value === value)?.count ?? 0,
    used: usedCounts.get(value) ?? 0,
  }));
}

/** Distribuição dos Atributos no formato `{value, count}`. */
export function attributeCounts(rules: CreationRules): { value: number; count: number }[] {
  return [...countValues(rules.attribute_distribution).entries()].map(([value, count]) => ({ value, count }));
}

/** Valores que passaram da conta (para destacar os campos em conflito). */
export function overused(status: CountStatus[]): Set<number> {
  return new Set(status.filter((s) => s.used > s.expected).map((s) => s.value));
}

export type Random = () => number;

function shuffle<T>(items: T[], rand: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Distribui a distribuição de Atributos do catálogo ao acaso entre os Atributos. */
export function randomAttributes(rules: CreationRules, rand: Random = Math.random): Record<string, number> {
  const values = shuffle(rules.attribute_distribution, rand);
  return Object.fromEntries(rules.attributes.map((a, i) => [a.id, values[i] ?? null]).filter(([, v]) => v !== null));
}

/** Valores de um perfil de Perícias, um por Perícia que recebe pontos (`[3, 2, 2, ...]`). */
export function profileValues(profile: SkillProfile): number[] {
  return profile.distribution.flatMap((d) => Array.from({ length: d.count }, () => d.value));
}

/** Distribui os valores do perfil ao acaso entre as Perícias do catálogo. */
export function randomSkills(rules: CreationRules, profile: SkillProfile, rand: Random = Math.random): Record<string, number> {
  const values = profileValues(profile);
  const chosen = shuffle(
    rules.skills.map((s) => s.id),
    rand,
  ).slice(0, values.length);
  return Object.fromEntries(chosen.map((id, i) => [id, values[i]!]));
}

/* --------------------------------------------------------------------- Mundo */

/** Semente aleatória de 0 a `max` (inclusive), com `crypto.getRandomValues`. */
export function randomSeed(max: number): number {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  // 53 bits: 21 do primeiro número e 32 do segundo.
  const value = (words[0]! & 0x1fffff) * 2 ** 32 + words[1]!;
  return max >= Number.MAX_SAFE_INTEGER ? value : value % (max + 1);
}

/** Próximo id livre de lugar (`lugar-N`), dentro do padrão do esquema. */
export function nextPlaceId(places: WorldPlace[]): string {
  const used = new Set(places.map((p) => p.id));
  let n = places.length + 1;
  while (used.has(`lugar-${n}`)) n++;
  return `lugar-${n}`;
}

/**
 * Mundo em branco ("Criar do zero") com as linhas mínimas do esquema: o mínimo de meses,
 * de dias da semana, de religiões e de lugares de `GET /worlds/schema`.
 */
export function blankWorld(schema: WorldSchema): WorldContent {
  const places: WorldPlace[] = [];
  for (let i = 0; i < schema.places.min; i++) places.push({ id: nextPlaceId(places), name: "", type: "", description: "" });
  return {
    schema: schema.schema,
    name: "",
    era: { name: "", description: "" },
    tone: { name: "", description: "" },
    calendar: {
      name: "",
      year: null,
      era_label: "",
      months: Array.from({ length: schema.months.min }, () => ({ name: "", days: null })),
      weekdays: Array.from({ length: schema.weekdays.min }, () => ""),
    },
    religions: Array.from({ length: schema.religions.min }, () => ({ name: "", domain: "", description: "" })),
    places,
  };
}

/** Cópia profunda simples (o conteúdo do Mundo é JSON). */
export const cloneWorld = (world: WorldContent): WorldContent => JSON.parse(JSON.stringify(world)) as WorldContent;

export interface Counts {
  months: number;
  weekdays: number;
  religions: number;
  places: number;
}

export function worldCounts(world: WorldContent): Counts {
  return {
    months: world.calendar.months.length,
    weekdays: world.calendar.weekdays.length,
    religions: world.religions.length,
    places: world.places.length,
  };
}

/** Pode acrescentar ou remover um item sem sair dos limites do esquema? */
export function canAdd(schema: WorldSchema, key: keyof Counts, world: WorldContent): boolean {
  return worldCounts(world)[key] < schema[key].max;
}

export function canRemove(schema: WorldSchema, key: keyof Counts, world: WorldContent): boolean {
  return worldCounts(world)[key] > schema[key].min;
}

/* ------------------------------------------------------------- erros e foco */

/** Id do elemento de um campo do assistente, a partir do caminho do erro (`places[0].name` → `w-places-0-name`). */
export function fieldId(prefix: string, path: string): string {
  return `${prefix}-${path.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "raiz"}`;
}

/** Caminho pai: `places[0].name` → `places[0]` → `places` → `""`. */
export function parentPath(path: string): string {
  const dot = path.lastIndexOf(".");
  const bracket = path.lastIndexOf("[");
  const cut = Math.max(dot, bracket);
  return cut <= 0 ? "" : path.slice(0, cut);
}

/** Leva o foco ao campo do primeiro erro que tiver elemento na tela (ou a um pai). */
export function focusFirstError(prefix: string, errors: FieldError[]): boolean {
  for (const e of errors) {
    let path = e.field;
    while (true) {
      const el = document.getElementById(fieldId(prefix, path));
      if (el) {
        el.focus();
        if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
        return true;
      }
      if (!path) break;
      path = parentPath(path);
    }
  }
  return false;
}

/** Tira o prefixo dos campos (`character.name` → `name`) e fica só com os que o têm. */
export function stripPrefix(errors: FieldError[], prefix: string): FieldError[] {
  return errors.filter((e) => e.field.startsWith(prefix)).map((e) => ({ ...e, field: e.field.slice(prefix.length) }));
}

/* ------------------------------------------------------------------ abas */

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

export type WorldTab = "geral" | "calendario" | "religioes" | "lugares";
export type CharacterTab = "ident" | "hist" | "obj" | "status";
export type ReviewTab = "mundo" | "personagem";

export const WORLD_TABS: TabDef<WorldTab>[] = [
  { id: "geral", label: "Visão geral" },
  { id: "calendario", label: "Calendário" },
  { id: "religioes", label: "Religiões" },
  { id: "lugares", label: "Lugares" },
];

export const CHARACTER_TABS: TabDef<CharacterTab>[] = [
  { id: "ident", label: "Identidade" },
  { id: "hist", label: "História" },
  { id: "obj", label: "Objetivos" },
  { id: "status", label: "Status" },
];

/** Aba do Mundo de um caminho de erro do servidor (`calendar.months[2].days` → Calendário). */
export function worldTabOf(field: string): WorldTab {
  if (field.startsWith("calendar")) return "calendario";
  if (field.startsWith("religions")) return "religioes";
  if (field.startsWith("places") || field === "start") return "lugares";
  return "geral";
}

/** Aba do Protagonista de um caminho de erro do servidor. */
export function characterTabOf(field: string): CharacterTab {
  if (field === "history" || field === "history_html") return "hist";
  if (field === "ambition" || field === "desire" || field.startsWith("convictions")) return "obj";
  if (field.startsWith("attributes") || field.startsWith("skill")) return "status";
  return "ident";
}

/** Erros contados por aba (as abas sem erro ficam com 0). */
export function countByTab<T extends string>(tabs: TabDef<T>[], errors: FieldError[], tabOf: (field: string) => T): Record<T, number> {
  const out = Object.fromEntries(tabs.map((t) => [t.id, 0])) as Record<T, number>;
  for (const e of errors) out[tabOf(e.field)] += 1;
  return out;
}

export type AdvanceMove<T extends string> = { kind: "stay" } | { kind: "tab"; tab: T } | { kind: "step" };

/**
 * O que o Avançar faz num passo com abas: com a aba atual incompleta, fica (e o passo
 * passa a mostrar os erros); senão vai à próxima aba incompleta, na ordem das abas e
 * recomeçando do início; sem nada faltando, vai ao passo seguinte.
 */
export function advanceMove<T extends string>(order: T[], current: T, pending: Record<T, number>): AdvanceMove<T> {
  if ((pending[current] ?? 0) > 0) return { kind: "stay" };
  const at = order.indexOf(current);
  const rest = [...order.slice(at + 1), ...order.slice(0, Math.max(at, 0))];
  const next = rest.find((t) => (pending[t] ?? 0) > 0);
  return next === undefined ? { kind: "step" } : { kind: "tab", tab: next };
}

/* ----------------------------------------------------------- texto da História */

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "LI", "BLOCKQUOTE", "UL", "OL"]);
const TEXT_BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

function inlineText(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) out += child.textContent ?? "";
    else if (child instanceof Element && child.tagName === "BR") out += " ";
    else if (child instanceof Element && !BLOCK_TAGS.has(child.tagName) && !SKIP_TAGS.has(child.tagName)) out += inlineText(child);
  });
  return out;
}

/** Só os blocos de dentro de um item de lista (o texto do item já foi contado). */
function itemBlocksOnly(item: Element): Node {
  const copy = item.ownerDocument.createElement("div");
  item.childNodes.forEach((child) => {
    if (child instanceof Element && BLOCK_TAGS.has(child.tagName)) copy.appendChild(child.cloneNode(true));
  });
  return copy;
}

function blockLines(container: Node, lines: string[]): void {
  let pending = "";
  const flush = () => {
    if (squash(pending)) lines.push(squash(pending));
    pending = "";
  };
  container.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      pending += child.textContent ?? "";
      return;
    }
    if (!(child instanceof Element) || SKIP_TAGS.has(child.tagName)) return;
    if (!BLOCK_TAGS.has(child.tagName)) {
      pending += child.tagName === "BR" ? " " : inlineText(child);
      return;
    }
    flush();
    if (TEXT_BLOCK_TAGS.has(child.tagName)) {
      const text = squash(inlineText(child));
      if (text) lines.push(text);
    } else if (child.tagName === "UL" || child.tagName === "OL") {
      let n = 0;
      child.childNodes.forEach((item) => {
        if (!(item instanceof Element) || item.tagName !== "LI") return;
        const text = squash(inlineText(item));
        const nested: string[] = [];
        blockLines(itemBlocksOnly(item), nested);
        if (!text && nested.length === 0) return;
        n += 1;
        if (text) lines.push(`${child.tagName === "OL" ? `${n}. ` : "- "}${text}`);
        lines.push(...nested);
      });
    } else {
      blockLines(child, lines); // citação, div e item solto
    }
  });
  flush();
}

/**
 * Texto puro de um HTML da História, como o servidor deriva (um bloco por linha, itens de
 * lista com "- " ou "N. "). Só para o contador do editor: a conta que vale é a do servidor.
 */
export function plainTextOfHtml(html: string): string {
  if (!html.trim()) return "";
  if (typeof DOMParser === "undefined") return squash(html.replace(/<[^>]*>/g, " "));
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  const lines: string[] = [];
  blockLines(doc.body, lines);
  return lines.join("\n");
}

/** Palavras de um texto puro (sem os marcadores de lista). */
export function wordCount(plain: string): number {
  return plain.split(/\s+/).filter((w) => w && !/^(-|\d+\.)$/.test(w)).length;
}
