import { describe, expect, it } from "vitest";

import { RULES, WORLD, WORLD_SCHEMA } from "../../test/gameData";
import {
  advanceMove,
  attributeCounts,
  blankWorld,
  CHARACTER_TABS,
  characterTabOf,
  countByTab,
  countStatus,
  emptyCharacter,
  fieldId,
  nextPlaceId,
  overused,
  parentPath,
  plainTextOfHtml,
  profileValues,
  randomAttributes,
  randomSeed,
  randomSkills,
  stripPrefix,
  toDraft,
  wordCount,
  worldTabOf,
} from "./model";

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("modelo do assistente", () => {
  it("rascunho vazio tem as Convicções e os Atributos do catálogo", () => {
    const form = emptyCharacter(RULES);
    expect(form.convictions).toHaveLength(RULES.convictions.count);
    expect(Object.keys(form.attributes)).toEqual(RULES.attributes.map((a) => a.id));
    expect(toDraft(form)).toEqual({
      name: "",
      concept: "",
      appearance: "",
      history: "",
      history_html: "",
      ambition: "",
      desire: "",
      convictions: form.convictions,
      attributes: {},
      skills: {},
    });
  });

  it("toDraft envia só Atributos com valor e Perícias acima de 0", () => {
    const form = { ...emptyCharacter(RULES), skill_profile: "equilibrado", attributes: { forca: 4, vigor: null }, skills: { lutar: 3, nadar: 0 } };
    expect(toDraft(form)).toMatchObject({ attributes: { forca: 4 }, skills: { lutar: 3 }, skill_profile: "equilibrado" });
  });

  it("Distribuir ao acaso usa exatamente a distribuição do catálogo", () => {
    for (const rand of [seq([0.1, 0.9, 0.5]), seq([0.99]), Math.random]) {
      const attrs = randomAttributes(RULES, rand);
      expect(Object.keys(attrs).sort()).toEqual(RULES.attributes.map((a) => a.id).sort());
      expect(Object.values(attrs).sort()).toEqual([...RULES.attribute_distribution].sort());
    }
    for (const profile of RULES.skill_profiles) {
      const skills = randomSkills(RULES, profile, Math.random);
      expect(Object.keys(skills)).toHaveLength(profile.total_skills);
      expect(Object.values(skills).sort()).toEqual(profileValues(profile).sort());
      for (const id of Object.keys(skills)) expect(RULES.skills.some((s) => s.id === id)).toBe(true);
    }
  });

  it("countStatus e overused comparam o usado com a distribuição", () => {
    const status = countStatus(attributeCounts(RULES), [4, 4, 3]);
    expect(status.find((s) => s.value === 4)).toEqual({ value: 4, expected: 1, used: 2 });
    expect(status.find((s) => s.value === 1)).toEqual({ value: 1, expected: 1, used: 0 });
    expect([...overused(status)]).toEqual([4]);
  });

  it("ids de lugar novos são únicos e seguem o padrão do esquema", () => {
    const id = nextPlaceId(WORLD.places);
    expect(WORLD.places.some((p) => p.id === id)).toBe(false);
    expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
    expect(nextPlaceId([{ id: "lugar-2", name: "", type: "", description: "" }])).toBe("lugar-3");
  });

  it("semente aleatória fica no intervalo", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed(Number.MAX_SAFE_INTEGER);
      expect(Number.isSafeInteger(s) && s >= 0).toBe(true);
      expect(randomSeed(10)).toBeLessThanOrEqual(10);
    }
  });

  it("caminhos de erro viram ids e têm pais", () => {
    expect(fieldId("w", "calendar.months[3].days")).toBe("w-calendar-months-3-days");
    expect(fieldId("w", "")).toBe("w-raiz");
    expect(parentPath("places[0].name")).toBe("places[0]");
    expect(parentPath("places[0]")).toBe("places");
    expect(parentPath("places")).toBe("");
    expect(stripPrefix([{ field: "character.name", code: "x", message: "m" }, { field: "name", code: "y", message: "n" }], "character.")).toEqual([
      { field: "name", code: "x", message: "m" },
    ]);
  });
});

describe("abas, Avançar e Mundo em branco", () => {
  it("cada erro do servidor cai na aba certa", () => {
    expect(worldTabOf("name")).toBe("geral");
    expect(worldTabOf("era.description")).toBe("geral");
    expect(worldTabOf("calendar.months[2].days")).toBe("calendario");
    expect(worldTabOf("religions[0].domain")).toBe("religioes");
    expect(worldTabOf("places[1].name")).toBe("lugares");
    expect(worldTabOf("start")).toBe("lugares");
    expect(characterTabOf("appearance")).toBe("ident");
    expect(characterTabOf("age")).toBe("ident");
    expect(characterTabOf("history")).toBe("hist");
    expect(characterTabOf("convictions[1].pillar")).toBe("obj");
    expect(characterTabOf("attributes.forca")).toBe("status");
    expect(characterTabOf("skill_profile")).toBe("status");
    const counts = countByTab(CHARACTER_TABS, [{ field: "name", code: "", message: "" }, { field: "skills", code: "", message: "" }], characterTabOf);
    expect(counts).toEqual({ ident: 1, hist: 0, obj: 0, status: 1 });
  });

  it("Avançar fica na aba incompleta, vai à próxima incompleta (recomeçando do início) ou ao passo seguinte", () => {
    const order = ["a", "b", "c", "d"] as const;
    const pending = (a: number, b: number, c: number, d: number) => ({ a, b, c, d });
    expect(advanceMove([...order], "b", pending(0, 1, 0, 0))).toEqual({ kind: "stay" });
    expect(advanceMove([...order], "a", pending(0, 0, 2, 1))).toEqual({ kind: "tab", tab: "c" });
    expect(advanceMove([...order], "c", pending(1, 0, 0, 0))).toEqual({ kind: "tab", tab: "a" });
    expect(advanceMove([...order], "d", pending(0, 0, 0, 0))).toEqual({ kind: "step" });
  });

  it("Criar do zero usa os mínimos do esquema", () => {
    const world = blankWorld(WORLD_SCHEMA);
    expect(world.schema).toBe(WORLD_SCHEMA.schema);
    expect(world.calendar.months).toHaveLength(WORLD_SCHEMA.months.min);
    expect(world.calendar.weekdays).toHaveLength(WORLD_SCHEMA.weekdays.min);
    expect(world.religions).toHaveLength(WORLD_SCHEMA.religions.min);
    expect(world.places.map((p) => p.id)).toEqual(Array.from({ length: WORLD_SCHEMA.places.min }, (_, i) => `lugar-${i + 1}`));
  });

  it("texto puro da História como o servidor deriva", () => {
    expect(plainTextOfHtml("")).toBe("");
    expect(plainTextOfHtml("<h3>Origens</h3><p>Cresceu  no <b>porto</b>.</p>")).toBe("Origens\nCresceu no porto.");
    expect(plainTextOfHtml("<ul><li>um</li><li>dois</li></ul><ol><li>a</li><li>b<ul><li>c</li></ul></li></ol>")).toBe(
      "- um\n- dois\n1. a\n2. b\n- c",
    );
    expect(plainTextOfHtml("<blockquote><p>citado</p></blockquote>solto<div>a<br>b</div>")).toBe("citado\nsolto\na b");
    expect(plainTextOfHtml("<p></p><p> </p><script>x</script>")).toBe("");
    expect(wordCount("- um\n1. dois três")).toBe(3);
    expect(toDraft({ ...emptyCharacter(RULES), history: "<p>Oi</p>" })).toMatchObject({ history: "Oi", history_html: "<p>Oi</p>" });
  });
});
