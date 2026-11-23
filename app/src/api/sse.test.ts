import { describe, expect, it } from "vitest";

import { SseParser } from "./sse";

describe("SseParser", () => {
  it("interpreta eventos completos num único chunk", () => {
    const parser = new SseParser();
    const events = parser.feed(
      'event: start\ndata: {"id":"a"}\n\nevent: token\ndata: {"text":"Olá"}\n\n',
    );
    expect(events).toEqual([
      { event: "start", data: '{"id":"a"}' },
      { event: "token", data: '{"text":"Olá"}' },
    ]);
  });

  it("junta eventos partidos entre chunks, inclusive no meio do nome do campo", () => {
    const parser = new SseParser();
    const raw = 'event: token\ndata: {"text":"espada"}\n\nevent: done\ndata: {}\n\n';
    const collected = [];
    for (const piece of raw.split("")) collected.push(...parser.feed(piece));
    expect(collected).toEqual([
      { event: "token", data: '{"text":"espada"}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("não dispara o evento antes da linha em branco", () => {
    const parser = new SseParser();
    expect(parser.feed("event: token\ndata: parcial")).toEqual([]);
    expect(parser.feed("\n")).toEqual([]);
    expect(parser.feed("\n")).toEqual([{ event: "token", data: "parcial" }]);
  });

  it("aceita \\r\\n partido entre chunks e \\r sozinho", () => {
    const parser = new SseParser();
    expect(parser.feed("data: a\r")).toEqual([]);
    expect(parser.feed("\n\r")).toEqual([]);
    expect(parser.feed("\ndata: b\r\r")).toEqual([{ event: "message", data: "a" }]);
    expect(parser.feed("x")).toEqual([{ event: "message", data: "b" }]);
  });

  it("concatena várias linhas data com quebra de linha", () => {
    const parser = new SseParser();
    expect(parser.feed("data: um\ndata: dois\n\n")).toEqual([{ event: "message", data: "um\ndois" }]);
  });

  it("ignora comentários, campos desconhecidos e blocos sem data", () => {
    const parser = new SseParser();
    expect(parser.feed(": ping\nretry: 1000\nfoo: bar\n\nevent: vazio\n\n")).toEqual([]);
  });

  it("remove apenas um espaço após os dois-pontos e trata campo sem valor", () => {
    const parser = new SseParser();
    expect(parser.feed("data:  dois espaços\n\ndata\n\n")).toEqual([
      { event: "message", data: " dois espaços" },
      { event: "message", data: "" },
    ]);
  });

  it("registra o id e remove o BOM inicial", () => {
    const parser = new SseParser();
    expect(parser.feed("﻿id: 7\ndata: x\n\n")).toEqual([{ event: "message", data: "x", id: "7" }]);
  });

  it("descarta evento incompleto no fim do fluxo", () => {
    const parser = new SseParser();
    parser.feed("event: token\ndata: sem fim");
    expect(parser.end()).toEqual([]);
  });
});
