import { z } from "zod";
import { HANDLE, readAccount } from "../../../lib/accounts.ts";
import { corpusCount } from "../../../lib/corpus.ts";
import { ingest } from "../../../lib/ingest.ts";
import { sameOrigin } from "../../../lib/origin.ts";
import { buildProfile } from "../../../lib/profile.ts";
import { slowJson } from "../../../lib/respond.ts";

const message = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" ") : e instanceof Error ? e.message : String(e));

// Learning a voice (reading the blog, then a model call) takes minutes, so it is a route like
// generate: as a server action every other action on the page would wait behind it. The page
// calls it after saving an account ({ handle, study: true } also reads its blog) or adding
// past posts. A second ask for the same account while one runs (a double submit) joins it.
const learning = new Map<string, Promise<void>>();

async function learn(handle: string, study: boolean): Promise<void> {
  const account = readAccount(handle);
  if (study && account.source_url) await ingest(account);
  if (corpusCount(handle) || account.x_samples.length || account.style?.length) await buildProfile(handle);
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Refused." }, { status: 403 });
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { handle?: unknown; study?: unknown };
  if (typeof body.handle !== "string" || !HANDLE.test(body.handle)) return Response.json({ error: "Which account?" });
  const handle = body.handle;
  let run = learning.get(handle);
  if (!run) {
    run = learn(handle, body.study === true).finally(() => learning.delete(handle));
    learning.set(handle, run);
  }
  const job = run;
  return slowJson(async () => {
    try {
      await job;
      return { ok: true };
    } catch (e) {
      return { error: message(e) };
    }
  });
}
