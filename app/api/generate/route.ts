import { z } from "zod";
import { generate } from "../../../lib/generate.ts";
import { sameOrigin } from "../../../lib/origin.ts";
import { slowJson } from "../../../lib/respond.ts";

const message = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" ") : e instanceof Error ? e.message : String(e));

// Generation is a route, not a server action: Next sends a page's server actions one at
// a time, so several accounts would draft back to back and Approve would wait behind them.
// The page calls this once per account, all at once.
export async function POST(request: Request): Promise<Response> {
  // Only the alienX page itself may start a generation, never another site open in the same browser.
  if (!sameOrigin(request)) return Response.json({ error: "Refused." }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  return slowJson(async () => {
    try {
      return { drafts: await generate(body) };
    } catch (e) {
      return { error: message(e) };
    }
  });
}
