"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Account, listAccounts, readAccount, writeAccount } from "../lib/accounts.ts";
import { readCorpus } from "../lib/corpus.ts";
import { createPost, decide, getPost, type Post, setTopic, updatePost } from "../lib/db.ts";
import { ingest } from "../lib/ingest.ts";
import { heldNear, slotFor } from "../lib/plan.ts";
import { buildProfile } from "../lib/profile.ts";
import { moveTo } from "../lib/schedule.ts";
import { local, ZONE } from "../lib/time.ts";

export type FormState = { ok?: string; error?: string; handle?: string } | null;

const message = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" ") : e instanceof Error ? e.message : String(e));
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

// Generation is not here: see app/api/generate/route.ts for why it is a route.

const Decision = z
  .object({
    id: z.number().int(),
    status: z.enum(["draft", "approved", "rejected"]),
    posts: z.array(z.string()).min(1).max(8),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.status !== "rejected" || Boolean(d.reason), "A rejection needs a reason.");

export async function decideAction(input: unknown): Promise<{ error?: string }> {
  try {
    const d = Decision.parse(input);
    decide(d.id, d.status, d.posts, d.reason);
    return {};
  } catch (e) {
    return { error: message(e) };
  }
}

// Schedule: the draft is approved (so the voice keeps learning) and goes on the schedule at
// the account's next free slot. The page then asks /api/art for its image.
const Schedule = z.object({ id: z.number().int(), handle: z.string(), topic_id: z.number().int().optional(), posts: z.array(z.string().trim().min(1)).min(1).max(8), claims: z.array(z.object({ text: z.string(), source: z.enum(["facts", "seed", "research", "unverified"]) })) });
export async function scheduleAction(input: unknown): Promise<{ post?: Post; error?: string }> {
  try {
    const d = Schedule.parse(input);
    decide(d.id, "approved", d.posts);
    // A draft made from a discovered idea keeps its link, so the post carries the idea's sources.
    const post = createPost({
      handle: d.handle,
      draft_id: d.id,
      topic_id: d.topic_id,
      posts: d.posts,
      claims: d.claims,
      source: d.topic_id ? "plan" : "seed",
      scheduled_at: slotFor(d.handle),
    });
    if (d.topic_id) setTopic(d.topic_id, "drafted");
    revalidatePath("/");
    return { post };
  } catch (e) {
    return { error: message(e) };
  }
}

const Id = z.number().int();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Change = z.discriminatedUnion("do", [
  z.object({ do: z.literal("move"), id: Id, day: Day }),
  z.object({ do: z.literal("edit"), id: Id, posts: z.array(z.string().trim().min(1)).min(1).max(8) }),
  z.object({ do: z.literal("kill"), id: Id, undo: z.boolean().optional() }),
  z.object({ do: z.literal("restore"), id: Id }),
  z.object({ do: z.literal("posted"), id: Id }),
]);

// Everything the owner can do to a scheduled post during its veto window, and after.
export async function changePostAction(input: unknown): Promise<{ post?: Post; error?: string }> {
  try {
    const c = Change.parse(input);
    const p = getPost(c.id);
    const now = new Date();
    let post: Post;
    if (c.do === "move") {
      if (p.status === "posted") throw new Error("That post is already out.");
      if (c.day < local(now, ZONE).day) throw new Error("Pick today or later.");
      const at = moveTo(p.handle, p.scheduled_at, c.day, now, heldNear(p.handle, now, p.id));
      post = updatePost(p.id, { scheduled_at: at.toISOString(), status: "scheduled" });
    } else if (c.do === "edit") {
      post = updatePost(p.id, { posts: c.posts });
    } else if (c.do === "kill") {
      if (p.status === "posted") throw new Error("That post is already out.");
      post = updatePost(p.id, { status: "killed" });
      // Undoing an approval in Create puts its idea back among the ideas.
      if (c.undo && p.topic_id) setTopic(p.topic_id, "proposed");
    } else if (c.do === "restore") {
      if (p.status !== "killed") throw new Error("That post was not killed.");
      // Undo of a kill: back on the schedule, or straight to due if its slot passed meanwhile.
      post = updatePost(p.id, { status: p.scheduled_at <= now.toISOString() ? "due" : "scheduled" });
    } else {
      post = updatePost(p.id, { status: "posted", posted_at: now.toISOString() });
      // Posting a researched draft is the owner's approval of it.
      if (p.draft_id) decide(p.draft_id, "approved", post.posts);
    }
    revalidatePath("/");
    return { post };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function skipTopicAction(id: unknown): Promise<{ error?: string }> {
  try {
    setTopic(Id.parse(id), "skipped");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: message(e) };
  }
}

// Adds an account, then ingests and profiles that account only.
export async function saveAccountAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const pillars = field("pillars").split(",").map((p) => p.trim()).filter(Boolean);
    const account = Account.parse({
      handle: field("handle").replace(/^@/, ""),
      display_name: field("display_name"),
      type: field("type"),
      pillars: pillars.length ? pillars : undefined,
      inherits: field("inherits") || undefined,
      source_url: field("source_url") || undefined,
      x_samples: lines(field("x_samples")),
    });
    const existing = listAccounts();
    if (existing.some((a) => a.handle.toLowerCase() === account.handle.toLowerCase())) throw new Error(`@${account.handle} already exists.`);
    if (account.inherits && !existing.some((a) => a.handle === account.inherits)) throw new Error(`@${account.inherits} is not an account here.`);
    if (!account.inherits && !account.source_url && !account.x_samples.length) {
      throw new Error("Nothing to study. Add a URL, past posts, or an account to inherit from.");
    }

    writeAccount(account);
    revalidatePath("/", "layout");
    if (account.source_url) await ingest(account);
    if (readCorpus(account.handle).length || account.x_samples.length) await buildProfile(account.handle);
    return { ok: `@${account.handle} is ready.`, handle: account.handle };
  } catch (e) {
    return { error: message(e) };
  }
}

// Past X posts sharpen an existing profile: they are stored as x_samples and the profile is rebuilt.
export async function addSamplesAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const account = readAccount(String(form.get("handle") ?? ""));
    const added = lines(String(form.get("x_samples") ?? ""));
    if (!added.length) throw new Error("Paste at least one post.");
    writeAccount({ ...account, x_samples: [...new Set([...account.x_samples, ...added])] });
    await buildProfile(account.handle);
    revalidatePath("/", "layout");
    return { ok: `${added.length} added. Profile rebuilt.` };
  } catch (e) {
    return { error: message(e) };
  }
}
