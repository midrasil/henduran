/** Fetch falso completo para testes que montam o `App` (saúde, motor e rotas de jogo). */
import { vi } from "vitest";

import { jsonResponse } from "./fakeFetch";
import { createFakeGameApi, type FakeGameOptions } from "./fakeGameApi";

export const INFO = { port: 5000, token: "t" };

export const ENGINE_IDLE = {
  state: "stopped",
  message: "",
  progress: 0,
  installed: false,
  version: null,
  variant: null,
  verified: null,
  active_model: null,
  active_model_name: null,
  log: "",
  provider: "fake",
};

/** Instala um `fetch` falso com o serviço de jogo; devolve o mock, o estado e as chamadas. */
export function stubGame(options: FakeGameOptions = {}) {
  const api = createFakeGameApi(options);
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/health")) return jsonResponse({ status: "ok", provider: { name: "fake", ready: true } });
    if (url.endsWith("/engine/status")) return jsonResponse(ENGINE_IDLE);
    const handled = api.handle(url, init);
    if (handled) return handled;
    throw new Error(`rota inesperada: ${init.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, api };
}
