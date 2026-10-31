import { sameOrigin } from "../../../lib/origin.ts";
import { draftTopic, research } from "../../../lib/plan.ts";
import { slowJson } from "../../../lib/respond.ts";

// { research: handle } discovers new ideas for one account now (Create's "Discover new ideas",
// a few minutes with web search). { id } drafts, schedules and illustrates one idea without
// the approval step; nothing in the app calls it, it is kept for scripts. Both can take
// longer than the tunnel waits for a first byte, so the reply is streamed.
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Refused." }, { status: 403 });
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { id?: unknown; research?: unknown };
  if (Number.isInteger(body.id)) return slowJson(async () => ({ post: await draftTopic(body.id as number) }));
  if (typeof body.research === "string" && /^[A-Za-z0-9_]{1,15}$/.test(body.research)) {
    const handle = body.research;
    return slowJson(async () => ({ topics: await research(handle) }));
  }
  return Response.json({ error: "Which topic or account?" });
}
