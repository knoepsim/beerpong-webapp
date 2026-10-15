export interface ServerEvent {
  event: string;
  data: string;
  id: string | null;
}

/**
 * Reads a Server-Sent Events stream (text/event-stream) from a fetch response body. `fetch` instead of `EventSource`
 * because only `fetch` can send the Authorization header that private tournaments need.
 * Comments (": ping") are skipped; an event is complete at the blank line.
 */
export async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  let id: string | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.search(/\r\n|\n|\r/)) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + (buffer.startsWith("\r\n", newline) ? 2 : 1));

        if (line === "") {
          if (data.length > 0) yield { event, data: data.join("\n"), id };
          event = "message";
          data = [];
          id = null;
        } else if (!line.startsWith(":")) {
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          const text = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = text;
          else if (field === "data") data.push(text);
          else if (field === "id") id = text;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
