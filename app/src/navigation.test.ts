import { describe, expect, it } from "vitest";

import type { JourneySnapshot } from "./api/journeys";
import { initialNav, navReducer } from "./navigation";

const journey = { journey: { id: "j" } } as unknown as JourneySnapshot;

describe("navegação para Modelos", () => {
  it("lembra a Nova Jornada como origem e volta para ela", () => {
    const opened = navReducer(initialNav, { type: "go", screen: "nova-jornada" });
    const models = navReducer(opened, { type: "go", screen: "modelos" });
    expect(models.modelsBack).toBe("nova-jornada");
    expect(navReducer(models, { type: "go", screen: "nova-jornada" }).screen).toBe("nova-jornada");
  });

  it("mantém Jornada e Menu como origens", () => {
    const inJourney = navReducer(initialNav, { type: "opened", snapshot: journey });
    expect(navReducer(inJourney, { type: "go", screen: "modelos" }).modelsBack).toBe("jornada");
    expect(navReducer(initialNav, { type: "go", screen: "modelos" }).modelsBack).toBe("menu");
  });

  it("não troca a origem ao reabrir Modelos a partir de Modelos", () => {
    const opened = navReducer(initialNav, { type: "go", screen: "nova-jornada" });
    const models = navReducer(opened, { type: "go", screen: "modelos" });
    expect(navReducer(models, { type: "go", screen: "modelos" }).modelsBack).toBe("nova-jornada");
  });
});
