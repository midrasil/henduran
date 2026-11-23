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
  history: string;
  ambition: string;
  desire: string;
  convictions: { text: string; pillar: string }[];
  /** `null` enquanto o Atributo não recebeu valor. */
  attributes: Record<string, number | null>;
  skill_profile: string | null;
  /** Perícias com valor; as ausentes valem 0. */
  skills: Record<string, number>;
}

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
    history: form.history,
    ambition: form.ambition,
    desire: form.desire,
    convictions: form.convictions.map((c) => ({ text: c.text, pillar: c.pillar })),
    attributes,
    skills,
  };
  if (form.skill_profile !== null) draft.skill_profile = form.skill_profile;
  return draft;
}

/** Nome padrão sugerido para a Jornada (o servidor usa o mesmo quando o nome fica em branco). */
export const defaultJourneyName = (characterName: string) => `A Jornada de ${characterName.trim() || "seu personagem"}`;

/** O jogador já escreveu ou escolheu algo no personagem? */
export function characterTouched(form: CharacterForm): boolean {
  const texts = [form.name, form.concept, form.appearance, form.history, form.ambition, form.desire];
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
