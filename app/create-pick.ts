// alienX's picks on the Create surface, from real signals only: which of five drafts it would
// post and why, and why it leads with an idea. Pure, so the page can call it on every render.
import type { Draft, Topic } from "../lib/db.ts";
import { problems, weighted } from "../lib/post.ts";
import type { Suggestion } from "../lib/suggest.ts";

type Allow = { hashtags: boolean; emoji: boolean; banned: string[] };

// The draft alienX recommends, in this order: no rule flags, no unverified claims, the idea's
// angle, the shortest hook. The reason names only those signals.
export function recommend(drafts: Draft[], allow: Allow, angle?: string): { id: number; angle: string; reason: string } | undefined {
  const facts = drafts.map((d) => ({
    d,
    flags: [...new Set(d.posts.flatMap((p) => problems(p, allow)))],
    unverified: d.claims.filter((c) => c.source === "unverified").length,
    match: Boolean(angle) && d.angle === angle,
    hook: weighted(d.posts[0]?.split("\n")[0] ?? ""),
  }));
  const best = facts.sort((x, y) => Number(x.flags.length > 0) - Number(y.flags.length > 0) || Number(x.unverified > 0) - Number(y.unverified > 0) || Number(y.match) - Number(x.match) || x.hook - y.hook)[0];
  if (!best) return undefined;
  const parts = [
    best.match && "matches the idea's angle",
    `${best.hook}-character hook`,
    best.flags.length ? `every draft has a rule flag (${best.flags[0]})` : "no rule flags",
    best.unverified ? `${best.unverified === 1 ? "1 claim" : `${best.unverified} claims`} to check` : best.d.claims.length > 0 && "every claim sourced",
  ].filter(Boolean) as string[];
  const reason = parts.join(", ");
  return { id: best.d.id, angle: best.d.angle, reason: `${reason[0]!.toUpperCase()}${reason.slice(1)}.` };
}

// The weekday each waiting idea would fill, from suggest()'s fill suggestions.
export function fills(suggestions: Suggestion[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const s of suggestions) {
    const day = /Fill (\w+) with/.exec(s.text)?.[1];
    if (s.kind === "fill" && s.action.type === "draft" && day) out[s.action.topicId] = day;
  }
  return out;
}

// Why an idea leads: its angle, pillar and sources, that it is the newest waiting, and the open
// day it fills when it is the one alienX would use for that.
export function ideaReason(t: Topic, newest: boolean, fillDay?: string): string {
  const sources = t.findings.length ? `, from ${t.findings.length === 1 ? "1 source" : `${t.findings.length} sources`}` : "";
  const base = `${t.angle ? `${t.angle[0]!.toUpperCase()}${t.angle.slice(1)} angle` : "An idea"}${t.pillar ? ` on ${t.pillar}` : ""}${sources}, ${newest ? "the newest idea waiting" : "the newest not drafted yet"}.`;
  return fillDay ? `${base} Fills ${fillDay}, which is open.` : base;
}
