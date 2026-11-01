// Pictures being drawn, shared by every screen: approving in Create starts one, and the post
// view joins it instead of starting another (or starts one itself when a post has none). Each
// drawing shows above the dock while it runs and resolves to the post with its picture.
import type { Post } from "../lib/db.ts";
import { startJob, type Where } from "./activity.tsx";

type Drawing = { since: number; done: Promise<Post | null> };
const inflight = new Map<number, Drawing>();

export const drawingOf = (id: number) => inflight.get(id);

export function draw(id: number, handle: string, where: Where = "week"): Drawing {
  const running = inflight.get(id);
  if (running) return running;
  const job = startJob({ handle, label: `Drawing the picture for @${handle}`, kind: "picture", where, typical: 35 });
  const done = fetch("/api/art", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
    .then((r) => r.json() as Promise<{ post?: Post; error?: string }>)
    .catch((e: unknown) => ({ error: String(e) }) as { post?: Post; error?: string })
    .then((r) => {
      inflight.delete(id);
      job(r.post ? { ok: true, text: "Picture ready." } : { ok: false, text: `The picture for @${handle} did not draw.` });
      return r.post ?? null;
    });
  const d = { since: Date.now(), done };
  inflight.set(id, d);
  return d;
}

// A version string for a post's picture, so the image reloads when it is redrawn.
export const artVersion = (p: Post) => (p.art && typeof p.art === "object" && "seed" in p.art ? `${(p.art as { seed: number }).seed}-${Date.now()}` : "");
