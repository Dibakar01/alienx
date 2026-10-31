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
export async function draftTopic(topicId: number): Promise<Post> {
  const topic = getTopic(topicId);
  if (topic.status !== "proposed") throw new Error(`That topic is already ${topic.status}.`);
  const drafts = await generate({
    handle: topic.handle,
    seed: `${topic.title}\n\n${topic.why}`,
    format: "single",
    pillar: topic.pillar ?? undefined,
    research: topic.findings,
  });
  const pick = drafts.find((d) => d.angle === topic.angle) ?? drafts[0]!;
  const post = createPost({
    handle: topic.handle,
    draft_id: pick.id,
    topic_id: topic.id,
    posts: pick.posts,
    claims: pick.claims,
    source: "plan",
    scheduled_at: slotFor(topic.handle),
  });
  setTopic(topic.id, "drafted");
  try {
    return await makeArt(post.id);
  } catch (e) {
    console.error(`post #${post.id}: no image yet (${e instanceof Error ? e.message : e})`);
    return post;
  }
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
        const post = await draftTopic(t.id);
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
