// A JSON reply for work that can outlast a proxy's patience. Cloudflare drops a request
// that sends nothing for about 100 seconds, while a draft or a research run can take
// minutes. This sends the headers at once and a space every 20 seconds, then the JSON;
// JSON.parse ignores leading whitespace, so callers read it with r.json() as before.
export function slowJson(work: () => Promise<unknown>): Response {
  const text = new TextEncoder();
  let beat: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    async start(out) {
      // If the reader left (tab closed, phone asleep), stop beating; the work still finishes and saves.
      beat = setInterval(() => {
        try {
          out.enqueue(text.encode(" "));
        } catch {
          clearInterval(beat);
        }
      }, 20_000);
      let reply: unknown;
      try {
        reply = await work();
      } catch (e) {
        reply = { error: e instanceof Error ? e.message : String(e) };
      }
      clearInterval(beat);
      try {
        out.enqueue(text.encode(JSON.stringify(reply)));
        out.close();
      } catch {
        // Nobody is listening any more; the result is already saved where it belongs.
      }
    },
    cancel() {
      clearInterval(beat);
    },
  });
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
