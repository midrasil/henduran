/**
 * Parser incremental de Server-Sent Events.
 *
 * Recebe texto em pedaços arbitrários (um evento pode chegar partido entre
 * vários chunks) e devolve os eventos completos. Segue o algoritmo de
 * interpretação do padrão HTML para `text/event-stream`, sem reconexão.
 */

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

export class SseParser {
  private buffer = "";
  private eventType = "";
  private dataLines: string[] = [];
  private lastId: string | undefined;
  private firstChunk = true;

  /** Acrescenta um pedaço de texto e devolve os eventos que ficaram completos. */
  feed(chunk: string): SseEvent[] {
    if (this.firstChunk && chunk.length > 0) {
      this.firstChunk = false;
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
    }
    this.buffer += chunk;
    const events: SseEvent[] = [];

    for (;;) {
      const match = /\r\n|\n|\r/.exec(this.buffer);
      if (!match) break;
      // Um "\r" no fim do buffer pode ser a primeira metade de "\r\n": espera o próximo chunk.
      if (match[0] === "\r" && match.index === this.buffer.length - 1) break;
      const line = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const event = this.processLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  /** Encerra o fluxo; um evento sem linha em branco final é descartado, como no padrão. */
  end(): SseEvent[] {
    const events: SseEvent[] = [];
    if (this.buffer.length > 0) {
      const line = this.buffer.replace(/\r$/, "");
      this.buffer = "";
      const event = this.processLine(line);
      if (event) events.push(event);
    }
    this.eventType = "";
    this.dataLines = [];
    return events;
  }

  private processLine(line: string): SseEvent | null {
    if (line === "") return this.dispatch();
    if (line.startsWith(":")) return null; // comentário

    const colon = line.indexOf(":");
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
    }

    switch (field) {
      case "event":
        this.eventType = value;
        break;
      case "data":
        this.dataLines.push(value);
        break;
      case "id":
        if (!value.includes("\u0000")) this.lastId = value;
        break;
      default:
        // "retry" e campos desconhecidos são ignorados.
        break;
    }
    return null;
  }

  private dispatch(): SseEvent | null {
    const hasData = this.dataLines.length > 0;
    const event: SseEvent = {
      event: this.eventType || "message",
      data: this.dataLines.join("\n"),
    };
    if (this.lastId !== undefined) event.id = this.lastId;
    this.eventType = "";
    this.dataLines = [];
    return hasData ? event : null;
  }
}
