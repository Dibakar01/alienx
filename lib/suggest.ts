// alienX's suggestions: what it would do next on your behalf, worked out from the calendar,
// the waiting ideas and each account's cadence. Only grounded suggestions: something due,
// a pick to review, a week short of its cadence, a missing picture, a claim to check, ideas
// running low. No invented insight (alienX has no reach or engagement data). Pure and
// browser-safe, so the Studio and the dial can call it on every render.
import type { Post, Topic } from "./db.ts";
import { addDays, clock, dayName, local, ZONE } from "./time.ts";

export type Suggestion = {
  id: string;
  kind: "due" | "review" | "fill" | "picture" | "claims" | "ideas";
  handle: string;
  text: string;
  // What pressing it does: open a post, draft a waiting idea, or discover new ideas.
  action: { type: "open"; postId: number } | { type: "draft"; topicId: number } | { type: "discover"; handle: string };
  label: string;
};

type Account = { handle: string; ready: boolean; cadence: { per_week: number } };

// The Monday that starts the Monday-to-Sunday week a day falls in.
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

export function suggest(accounts: Account[], posts: Post[], topics: Topic[], now: Date): Suggestion[] {
  const today = local(now, ZONE).day;
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const dayOf = (p: Post) => local(new Date(p.scheduled_at), ZONE).day;
  const live = posts.filter((p) => p.status !== "killed");
  const out: Suggestion[] = [];

  for (const p of live.filter((p) => p.status === "due"))
    out.push({ id: `due-${p.id}`, kind: "due", handle: p.handle, text: `@${p.handle}'s post is due now.`, action: { type: "open", postId: p.id }, label: "Post it" });

  const ahead = live.filter((p) => p.status === "scheduled" && p.scheduled_at > now.toISOString());
  for (const p of ahead.filter((p) => p.picked))
    out.push({ id: `review-${p.id}`, kind: "review", handle: p.handle, text: `alienX picked @${p.handle}'s post for ${dayName(dayOf(p))}, ${clock(p.scheduled_at)}. Give it a look.`, action: { type: "open", postId: p.id }, label: "Review" });

  for (const a of accounts.filter((a) => a.ready)) {
    const mine = live.filter((p) => p.handle === a.handle);
    const thisWeek = mine.filter((p) => dayOf(p) >= monday && dayOf(p) <= sunday).length;
    const ideas = topics.filter((t) => t.handle === a.handle && t.status === "proposed");
    // The first day from tomorrow to Sunday with nothing on it for this account.
    const free = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).find((d) => d <= sunday && !mine.some((p) => dayOf(p) === d));
    if (thisWeek < a.cadence.per_week && free) {
      const best = ideas[0];
      const short = `@${a.handle} has ${thisWeek} of ${a.cadence.per_week} posts this week.`;
      out.push(
        best
          ? { id: `fill-${a.handle}`, kind: "fill", handle: a.handle, text: `${short} Fill ${dayName(free, { weekday: "long" })} with "${best.title}".`, action: { type: "draft", topicId: best.id }, label: "Draft it" }
          : { id: `fill-${a.handle}`, kind: "fill", handle: a.handle, text: `${short} No ideas are waiting to fill ${dayName(free, { weekday: "long" })}.`, action: { type: "discover", handle: a.handle }, label: "Discover ideas" },
      );
    } else if (ideas.length < 2) {
      out.push({ id: `ideas-${a.handle}`, kind: "ideas", handle: a.handle, text: `Only ${ideas.length === 1 ? "one idea is" : "no ideas are"} waiting for @${a.handle}.`, action: { type: "discover", handle: a.handle }, label: "Discover ideas" });
    }
  }

  for (const p of ahead.filter((p) => !p.art))
    out.push({ id: `picture-${p.id}`, kind: "picture", handle: p.handle, text: `@${p.handle}'s post for ${dayName(dayOf(p))} has no picture yet.`, action: { type: "open", postId: p.id }, label: "Draw it" });

  for (const p of ahead) {
    const n = p.claims.filter((c) => c.source === "unverified").length;
    if (n) out.push({ id: `claims-${p.id}`, kind: "claims", handle: p.handle, text: `${n === 1 ? "One claim" : `${n} claims`} in @${p.handle}'s ${dayName(dayOf(p))} post ${n === 1 ? "needs" : "need"} checking.`, action: { type: "open", postId: p.id }, label: "Check" });
  }

  // Most urgent first: due, then picks to review, then the rest in the order found.
  const rank: Suggestion["kind"][] = ["due", "review", "claims", "picture", "fill", "ideas"];
  return out.sort((x, y) => rank.indexOf(x.kind) - rank.indexOf(y.kind));
}
