// What a person keeps and what they pass on: every idea they drafted or skipped, per account,
// counted by angle and pillar. Discovery leans toward what gets drafted, and Create puts the
// waiting idea that best fits it on top. Pure, so the page and the research run share it.
import type { Topic } from "./db.ts";

export type Taste = { angle: Record<string, number>; pillar: Record<string, number>; drafted: number; skipped: number };

const bump = (m: Record<string, number>, k: string | null, by: number) => {
  if (k) m[k] = (m[k] ?? 0) + by;
};

// Drafted counts +1, skipped -1, for the idea's angle and its pillar. The newest 60 decisions
// per account count, so the taste follows the person as they change.
export function taste(history: Topic[], handle: string): Taste {
  const t: Taste = { angle: {}, pillar: {}, drafted: 0, skipped: 0 };
  for (const h of history.filter((x) => x.handle === handle && x.status !== "proposed").slice(0, 60)) {
    const by = h.status === "drafted" ? 1 : -1;
    bump(t.angle, h.angle, by);
    bump(t.pillar, h.pillar, by);
    if (by > 0) t.drafted++;
    else t.skipped++;
  }
  return t;
}

// How well a waiting idea fits: its angle's score plus its pillar's.
export const fit = (t: Pick<Topic, "angle" | "pillar">, taste?: Taste) => (taste ? (taste.angle[t.angle] ?? 0) + (t.pillar ? (taste.pillar[t.pillar] ?? 0) : 0) : 0);

// The strongest likes and dislikes in a few words, for a reason line or a prompt.
export function liked(taste?: Taste): { likes: string[]; dislikes: string[] } {
  if (!taste) return { likes: [], dislikes: [] };
  const all = [...Object.entries(taste.angle).map(([k, v]) => [`${k} ideas`, v] as const), ...Object.entries(taste.pillar).map(([k, v]) => [k, v] as const)];
  const sorted = [...all].sort((a, b) => b[1] - a[1]);
  return { likes: sorted.filter(([, v]) => v >= 2).slice(0, 3).map(([k]) => k), dislikes: sorted.reverse().filter(([, v]) => v <= -2).slice(0, 3).map(([k]) => k) };
}
