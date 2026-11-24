/** Navegação do app: um redutor simples, sem biblioteca de rotas. */
import type { JourneySnapshot, OpenJourneySummary } from "./api/journeys";

export type Screen = "menu" | "jornadas" | "mundos" | "nova-jornada" | "modelos" | "jornada";

export interface NavState {
  screen: Screen;
  /** Jornada aberta no serviço (somente leitura na interface). */
  journey: JourneySnapshot | null;
  /** Para onde "Voltar" leva a partir de Modelos. */
  modelsBack: "menu" | "jornada";
  /** Aviso a mostrar na tela de destino. */
  notice: string | null;
}

export type NavAction =
  | { type: "go"; screen: Screen; notice?: string }
  | { type: "opened"; snapshot: JourneySnapshot }
  /** Nome ou descrição da Jornada aberta editados (o resto do retrato da Jornada não muda). */
  | { type: "summary"; journey: OpenJourneySummary }
  | { type: "closed" };

export const initialNav: NavState = { screen: "menu", journey: null, modelsBack: "menu", notice: null };

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "go": {
      // A tela da Jornada só existe com uma Jornada aberta.
      if (action.screen === "jornada" && !state.journey) return { ...state, screen: "menu", notice: null };
      const modelsBack = action.screen === "modelos" ? (state.screen === "jornada" ? "jornada" : "menu") : state.modelsBack;
      return { ...state, screen: action.screen, modelsBack, notice: action.notice ?? null };
    }
    case "opened":
      return { ...state, screen: "jornada", journey: action.snapshot, notice: null };
    case "summary":
      return state.journey ? { ...state, journey: { ...state.journey, journey: action.journey } } : state;
    case "closed":
      return { ...state, screen: "menu", journey: null, notice: null };
  }
}
