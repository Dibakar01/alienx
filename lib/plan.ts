import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { listAccounts, readAccount } from "./accounts.ts";
import { ArtSpec, artPath, rasterize, renderArt } from "./art.ts";
import { createPost, getPost, getTopic, listTopics, type Post, saveTopics, setTopic, takenSlots, type Topic, updatePost } from "./db.ts";
import { ANGLES, facts, generate, voice } from "./generate.ts";
import { ask, prompt } from "./llm.ts";
import { local, nextSlot, osascript, rules } from "./schedule.ts";
import { addDays } from "./time.ts";

const Research = z.object({
  // Web links only: a source is rendered as a link, so nothing like javascript: may pass.
  findings: z.array(z.object({ claim: z.string(), url: z.url({ protocol: /^https?$/ }), title: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).max(10),
  topics: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        pillar: z.string().optional(),
        angle: z.enum(ANGLES),
        why: z.string().min(1).max(400),
        takeaway: z.string().min(1).max(300),
        findings: z.array(z.number().int().min(0)),
      }),
    )
    .min(1)
    .max(7),
});

// The image for a post: the model plans a visual metaphor (objects, a composition and at
// most three words); code draws it. A failed image never loses the post; it shows without
// one and can be remade.
export async function makeArt(postId: number): Promise<Post> {
  const post = getPost(postId);
  const p = prompt("art", { handle: post.handle, posts: post.posts.join("\n\n") });
  const spec = await ask(ArtSpec, p.system, p.user);
  const svg = artPath(post.id, "svg");
  fs.mkdirSync(path.dirname(svg), { recursive: true });
  fs.writeFileSync(svg, renderArt(spec));
  await rasterize(svg, artPath(post.id, "png"));
  return updatePost(post.id, { art: spec });
}

// The slots an account holds from a week before now, so posts earlier today and earlier
// this week count towards the day, gap and week limits.
export const heldNear = (handle: string, now: Date, except?: number) => takenSlots(handle, new Date(now.getTime() - 7 * 24 * 3600_000).toISOString(), except);

// The next free slot for an account, from now.
export function slotFor(handle: string, now = new Date()): string {
  return nextSlot(handle, now, heldNear(handle, now)).toISOString();
}

// Searches the web for one account and saves this week's topics, each with its sources.
export async function research(handle: string, now = new Date()): Promise<Topic[]> {
  const account = readAccount(handle);
  const count = rules(handle).per_week;
  const pillars = account.pillars ?? [];
  const recent = (["drafted", "skipped", "proposed"] as const)
    .flatMap((s) => listTopics(s))
    .filter((t) => t.handle === handle)
    .slice(0, 20)
    .map((t) => `- ${t.title}`);
  const p = prompt("research", {
    min: String(Math.max(3, count)),
    count: String(count),
    today: local(now, "Asia/Kolkata").day,
    facts: facts(),
    handle,
    voice: JSON.stringify(voice(account), null, 2),
    pillars: pillars.join(", ") || "none set",
    recent: recent.join("\n") || "(none yet)",
  });
  const r = await ask(Research, p.system, p.user, { tools: ["WebSearch", "WebFetch"], timeoutMs: 20 * 60_000 });
  // Only what is new: a finding older than three weeks is dropped, whatever the model said.
  const today = local(now, "Asia/Kolkata").day;
  const fresh = r.findings.map((f) => (f.date >= addDays(today, -21) && f.date <= today ? f : null));
  return saveTopics(
    handle,
    local(now, "Asia/Kolkata").day,
    r.topics.slice(0, count).map((t) => ({
      title: t.title,
      pillar: t.pillar && pillars.includes(t.pillar) ? t.pillar : undefined,
      angle: t.angle,
      why: `${t.why}\nTakeaway: ${t.takeaway}`,
      findings: t.findings.flatMap((i) => (fresh[i] ? [{ claim: fresh[i].claim, url: fresh[i].url, title: `${fresh[i].title} (${fresh[i].date})` }] : [])),
    })),
  );
}

// One topic becomes one scheduled post with its image. The five variants are drafted as
// usual and the one in the topic's angle is kept; the others stay in the drafts table.
// `onlyIfFree` (alienX's pick) books nothing when the account gained a post while drafting:
// a second pick running at the same time, or one approved meanwhile. The check and the insert
// run back to back with nothing awaited between them.
export async function draftTopic(topicId: number, onlyIfFree = false): Promise<Post | null> {
  const topic = getTopic(topicId);
  if (topic.status !== "proposed") throw new Error(`That topic is already ${topic.status}.`);
  // Taken off the waiting ideas at once, so nobody drafts it again from Create meanwhile;
  // it goes back if drafting fails.
  setTopic(topic.id, "drafted");
  try {
    return await draftTaken(topic, onlyIfFree);
  } catch (e) {
    setTopic(topic.id, "proposed");
    throw e;
  }
}

async function draftTaken(topic: Topic, onlyIfFree: boolean): Promise<Post | null> {
  const drafts = await generate({
    handle: topic.handle,
    seed: `${topic.title}\n\n${topic.why}`,
    format: "single",
    pillar: topic.pillar ?? undefined,
    research: topic.findings,
  });
  const pick = drafts.find((d) => d.angle === topic.angle) ?? drafts[0]!;
  if (onlyIfFree && takenSlots(topic.handle, new Date().toISOString()).length) {
    setTopic(topic.id, "proposed"); // nothing booked: the idea waits for another day
    return null;
  }
  const post = createPost({
    handle: topic.handle,
    draft_id: pick.id,
    topic_id: topic.id,
    posts: pick.posts,
    claims: pick.claims,
    source: "plan",
    // A pick nobody approved yet gets at least three hours on the calendar to be looked at.
    scheduled_at: slotFor(topic.handle, onlyIfFree ? new Date(Date.now() + 3 * 3600_000) : undefined),
  });
  setTopic(topic.id, "drafted");
  try {
    return await makeArt(post.id);
  } catch (e) {
    console.error(`post #${post.id}: no image yet (${e instanceof Error ? e.message : e})`);
    return post;
  }
}

// alienX's pick: every account with a voice keeps at least one approved post ahead of it.
// When nothing is coming, the best waiting idea (discovering some first if none wait) is
// drafted, illustrated and booked into the next slot the cadence allows (config/slots.json:
// per day, per week and the gap). It never posts; the Studio still waits for a tap.
// An account has a voice once it has a profile of its own or inherits one.
const voiced = (handle: string) => {
  const account = readAccount(handle);
  return Boolean(account.profile ?? (account.inherits ? readAccount(account.inherits).profile : undefined));
};

export async function pickFor(handle: string, now = new Date()): Promise<Post | null> {
  if (!voiced(handle) || takenSlots(handle, now.toISOString()).length) return null;
  let ideas = listTopics("proposed").filter((t) => t.handle === handle);
  if (!ideas.length) ideas = await research(handle, now);
  // A mix: not the same angle as the last idea it drafted, when another is waiting.
  const last = listTopics("drafted").find((t) => t.handle === handle)?.angle;
  const best = ideas.find((t) => t.angle !== last) ?? ideas[0];
  return best ? draftTopic(best.id, true) : null;
}

// The daily run: one pick per account that needs one, and fresh ideas for any account
// running low, one account after another.
export async function daily(only?: string): Promise<number> {
  let failed = 0;
  for (const { handle } of only ? [{ handle: only }] : listAccounts()) {
    try {
      const post = await pickFor(handle);
      console.log(post ? `@${handle}: picked #${post.id} for ${post.scheduled_at}` : `@${handle}: already has a post ahead`);
      // Fewer than two ideas left: discover fresh ones now, so tomorrow's pick has a choice.
      if (voiced(handle) && listTopics("proposed").filter((t) => t.handle === handle).length < 2) console.log(`@${handle}: ${(await research(handle)).length} fresh ideas`);
    } catch (e) {
      failed++;
      console.error(`@${handle}: no pick today (${e instanceof Error ? e.message : e})`);
    }
  }
  if (failed) osascript(`alienX could not choose today's pick for ${failed === 1 ? "1 account" : `${failed} accounts`}. Open Create to pick one.`);
  return failed;
}

// The weekly run. Accounts go one after another because they share one subscription
// limit; a failure costs that account this week and keeps everything already saved.
export async function plan(opts: { only?: string; researchOnly?: boolean } = {}): Promise<number> {
  const handles = opts.only ? [opts.only] : listAccounts().map((a) => a.handle);
  const failed: string[] = [];
  for (const handle of handles) {
    try {
      const topics = await research(handle);
      console.log(`@${handle}: ${topics.length} topics`);
      if (opts.researchOnly) continue;
      for (const t of topics) {
        const post = (await draftTopic(t.id))!;
        console.log(`  #${post.id} at ${post.scheduled_at}: ${post.posts[0]}`);
      }
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      console.error(`@${handle}: stopped (${why})`);
      failed.push(`@${handle}: ${why}`);
    }
  }
  // Nobody watches the Sunday run, so a failure says so on screen, not only in the log.
  if (failed.length) osascript(`The weekly plan stopped for ${failed.length === 1 ? "1 account" : `${failed.length} accounts`}. ${failed[0]!.slice(0, 160)}`);
  return failed.length;
}
