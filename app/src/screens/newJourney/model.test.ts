import { describe, expect, it } from "vitest";

import { RULES, WORLD } from "../../test/gameData";
import {
  attributeCounts,
  countStatus,
  emptyCharacter,
  fieldId,
  nextPlaceId,
  overused,
  parentPath,
  profileValues,
  randomAttributes,
  randomSeed,
  randomSkills,
  stripPrefix,
  toDraft,
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
