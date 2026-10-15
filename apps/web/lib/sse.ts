export interface ServerEvent {
  event: string;
  data: string;
  id: string | null;
}

/** Turns the bytes of a text/event-stream into events: a line at a time, an event is complete at the blank line. */
class EventParser {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private event = "message";
  private data: string[] = [];
  private id: string | null = null;

  feed(chunk: Uint8Array): ServerEvent[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const events: ServerEvent[] = [];
    for (let line = this.nextLine(); line !== null; line = this.nextLine()) {
      const event = this.readLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  /** The next complete line, or null while the buffer holds none. A "\r" at the very end may be half of "\r\n". */
  private nextLine(): string | null {
    const match = /\r\n|\n|\r/.exec(this.buffer);
    if (!match || (match[0] === "\r" && match.index === this.buffer.length - 1)) return null;
    const line = this.buffer.slice(0, match.index);
    this.buffer = this.buffer.slice(match.index + match[0].length);
    return line;
  }

  private readLine(line: string): ServerEvent | null {
    if (line === "") return this.dispatch();
    if (line.startsWith(":")) return null; // comment, e.g. the ping that keeps the connection open
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") this.event = value;
    else if (field === "data") this.data.push(value);
    else if (field === "id") this.id = value;
    return null;
  }

  private dispatch(): ServerEvent | null {
    const event = this.data.length > 0 ? { event: this.event, data: this.data.join("\n"), id: this.id } : null;
    this.event = "message";
    this.data = [];
    this.id = null;
    return event;
  }
}

/**
 * Reads a Server-Sent Events stream (text/event-stream) from a fetch response body. `fetch` instead of `EventSource`
 * because only `fetch` can send the Authorization header that private tournaments need.
 */
export async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerEvent> {
  const reader = body.getReader();
  const parser = new EventParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield* parser.feed(value);
    }
  } finally {
    reader.releaseLock();
  }
}
