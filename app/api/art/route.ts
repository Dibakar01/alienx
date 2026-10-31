import fs from "node:fs";
import { artPath } from "../../../lib/art.ts";
import { sameOrigin } from "../../../lib/origin.ts";
import { makeArt } from "../../../lib/plan.ts";
import { slowJson } from "../../../lib/respond.ts";

// Making an image takes a model call and a Chrome render, so it is a route like generate:
// server actions would queue behind it.
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Refused." }, { status: 403 });
  const { id } = ((await request.json().catch(() => ({}))) ?? {}) as { id?: unknown };
  if (!Number.isInteger(id)) return Response.json({ error: "Which post?" });
  return slowJson(async () => ({ post: await makeArt(id as number) }));
}

// The post's PNG, for the Studio and for handing to X.
export async function GET(request: Request): Promise<Response> {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return new Response("Which post?", { status: 400 });
  try {
    return new Response(fs.readFileSync(artPath(id, "png")), { headers: { "content-type": "image/png", "cache-control": "no-cache" } });
  } catch {
    return new Response("No image yet.", { status: 404 });
  }
}
