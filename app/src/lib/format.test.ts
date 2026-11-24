import { describe, expect, it } from "vitest";

import { BackendError } from "../api/backend";
import { describeCounts, formatBackupDate, formatSavedAgo, formatSavedAt, joinList, openErrorMessage, toPeriod } from "./format";

describe("formatação", () => {
  it("data de salvamento legível em pt-BR, na hora local", () => {
    const now = new Date(2026, 10, 23, 18, 0);
    expect(formatSavedAt(new Date(2026, 10, 23, 14, 27).toISOString(), now)).toBe("Hoje, 14:27");
    expect(formatSavedAt(new Date(2026, 10, 22, 9, 5).toISOString(), now)).toBe("Ontem, 09:05");
    expect(formatSavedAt(new Date(2026, 0, 3, 7, 0).toISOString(), now)).toMatch(/^3 de jan\.? de 2026, 07:00$/);
    expect(formatSavedAt(null, now)).toBe("nunca");
  });

  it("há quanto tempo foi salvo (cartão do menu)", () => {
    const now = new Date(2026, 10, 23, 18, 0);
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(formatSavedAgo(ago(20 * 1000), now)).toBe("Salvo agora há pouco");
    expect(formatSavedAgo(ago(60 * 1000), now)).toBe("Salvo há 1 minuto");
    expect(formatSavedAgo(ago(45 * 60 * 1000), now)).toBe("Salvo há 45 minutos");
    expect(formatSavedAgo(ago(2 * 3600 * 1000 + 59 * 60 * 1000), now)).toBe("Salvo há 2 horas");
    expect(formatSavedAgo(ago(26 * 3600 * 1000), now)).toBe("Salvo há 1 dia");
    expect(formatSavedAgo(ago(40 * 24 * 3600 * 1000), now)).toMatch(/^Salvo: \d+ de out\.? de 2026, 18:00$/);
    expect(formatSavedAgo(ago(-5 * 60 * 1000), now)).toBe("Salvo: Hoje, 18:05");
    expect(formatSavedAgo(null, now)).toBe("Nunca salvo");
  });

  it("data de backup", () => {
    expect(formatBackupDate("20261122-101500")).toBe("22/11/2026 às 10:15:00");
    expect(formatBackupDate("estranho")).toBe("estranho");
  });

  it("contagens e listas", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b", "c"])).toBe("a, b e c");
    expect(describeCounts([{ value: 3, count: 1 }, { value: 2, count: 6 }, { value: 1, count: 0 }])).toBe("1 em 3 e 6 em 2");
  });

  it("período desconhecido vira o padrão", () => {
    expect(toPeriod("noite")).toBe("noite");
    expect(toPeriod("meio-dia")).toBe("entardecer");
    expect(toPeriod(null)).toBe("entardecer");
  });

  it("erros de abrir com mensagem clara", () => {
    expect(openErrorMessage(new BackendError("x", 409, "banco_danificado"))).toMatch(/restaurar um backup/);
    expect(openErrorMessage(new BackendError("Mensagem do serviço.", 409, "outro"))).toBe("Mensagem do serviço.");
  });
});
