import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import style from "../config/style-rules.json" with { type: "json" };
import { type Account, HANDLE, readAccount } from "./accounts.ts";
import { type Article, readCorpus } from "./corpus.ts";
import { type Draft, recent, saveDrafts } from "./db.ts";
import { ask, prompt } from "./llm.ts";
import { problems } from "./post.ts";

export const ANGLES = ["story", "contrarian", "observation", "lesson", "question"] as const;

export const Request = z.object({
  handle: z.string().regex(HANDLE),
  seed: z.string().trim().min(1).max(4000),
  format: z.enum(["single", "thread"]),
  // Checked against the account's own pillars in context(), which has the account.
  pillar: z.string().trim().min(1).max(40).optional(),
  hashtags: z.boolean().default(false),
  // What the weekly research found, so drafts can state it with a source.
  research: z.array(z.object({ claim: z.string(), url: z.url({ protocol: /^https?$/ }), title: z.string() })).default([]),
});
export type Request = z.infer<typeof Request>;

// What the model must return. What each field means is in prompts/generate.md.
const Variants = z.object({
  variants: z
    .array(
      z.object({
        angle: z.enum(ANGLES),
        posts: z.array(z.string()).min(1).max(8),
        claims: z.array(z.object({ text: z.string(), source: z.enum(["facts", "seed", "research", "unverified"]) })),
      }),
    )
    .length(ANGLES.length),
});

const STOP = new Set(
  "the and for that this with you your are was were have has had not but from they them their what when where which who will would can could should about into over than then there here just like more some such only very been being also our out get got one its".split(" "),
);
const terms = (s: string) => [...new Set(s.toLowerCase().match(/[a-z0-9']{3,}/g) ?? [])].filter((w) => !STOP.has(w));

// The 3 to 5 corpus paragraphs that share the most words with the seed, one per article.
// ponytail: plain keyword overlap, no stemming or embeddings. Move to BM25 if excerpts drift off-topic.
export function excerpts(seed: string, corpus: Article[], max = 5, min = 3): { text: string; url: string }[] {
  const wanted = terms(seed);
  const scored = corpus.flatMap((a) =>
    a.body
      .split("\n\n")
      .filter((p) => !p.startsWith("> ") && !p.startsWith("## ") && p.length >= 80 && p.length <= 900)
      .map((text) => {
        const has = new Set(terms(text));
        return { text, url: a.url, score: wanted.filter((w) => has.has(w)).length };
      }),
  );
  scored.sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  const picked: typeof scored = [];
  for (const s of scored) {
    if (picked.length >= max || (s.score === 0 && picked.length >= min)) break;
    if (!picked.some((p) => p.url === s.url)) picked.push(s);
  }
  return picked.map(({ text, url }) => ({ text, url }));
}

// The company facts: the only source for anything said about Qalakaar.
export const facts = () => fs.readFileSync(path.join(process.cwd(), "knowledge", "qalakaar-facts.md"), "utf8").trim();

// The voice an account writes in: its own profile, or its parent's with the account's layer on top.
export function voice(account: Account) {
  const parent = account.inherits ? readAccount(account.inherits) : undefined;
  const profile = account.profile ?? parent?.profile;
  if (!profile) throw new Error(`@${account.handle} has no voice profile yet.`);
  return {
    display_name: account.display_name,
    type: account.type,
    profile,
    base_profile: account.profile ? parent?.profile : undefined,
    brand_layer: account.brand_layer,
    x_samples: account.x_samples,
  };
}

// Everything the model is given, in the order the brief sets: facts, voice, excerpts,
// approved posts, rejected posts with reasons, then the seed.
export function context(req: z.input<typeof Request>): { vars: Record<string, string>; emoji: boolean; banned: string[] } {
  const account = readAccount(req.handle);
  const pillars = account.pillars ?? [];
  if (req.pillar && !pillars.includes(req.pillar)) throw new Error(`${req.pillar} is not a pillar of @${account.handle}.`);
  const v = voice(account);
  const own = readCorpus(account.handle);
  const corpus = own.length || !account.inherits ? own : readCorpus(account.inherits);
  const block = (rows: string[]) => rows.join("\n\n") || "(none yet)";
  return {
    emoji: v.profile.uses_emoji,
    banned: account.banned_words ?? [],
    vars: {
      facts: facts(),
      handle: account.handle,
      voice: JSON.stringify(v, null, 2),
      excerpts: block(excerpts(req.seed, corpus).map((e) => e.text)),
      approved: block(recent(account.handle, "approved").map((d) => d.posts.join("\n"))),
      rejected: block(recent(account.handle, "rejected").map((d) => `${d.posts.join("\n")}\nRejected because: ${d.reason}`)),
      rules: style.rules.map((r) => `- ${r}`).join("\n"),
      format: req.format,
      pillars: pillars.join(", ") || "none set",
      pillar: req.pillar ?? (pillars.length ? "whichever of this account's pillars the seed fits best" : "none"),
      hashtags: req.hashtags ? "yes" : "no",
      seed: req.seed,
      research: (req.research ?? []).map((f) => `- ${f.claim} (${f.title}, ${f.url})`).join("\n") || "(none)",
    },
  };
}

// Five variants for one account, saved as drafts. Length and rules are checked here in
// code. A draft that breaks one gets a single repair attempt, and whatever still fails
// is returned as it is for the reviewer to see. Nothing is ever truncated.
export async function generate(input: unknown): Promise<Draft[]> {
  const req = Request.parse(input);
  const { vars, emoji, banned } = context(req);
  const allow = { hashtags: req.hashtags, emoji, banned };
  const first = prompt("generate", vars);
  let { variants } = await ask(Variants, first.system, first.user);

  const broken = variants.flatMap((v, i) => {
    const where = `variant ${i + 1} (${v.angle})`;
    const count = req.format === "single" ? v.posts.length === 1 : v.posts.length >= 3;
    return [
      ...(count ? [] : [`${where}: has ${v.posts.length} posts, which is wrong for the ${req.format} format`]),
      ...v.posts.flatMap((p, j) => problems(p, allow).map((x) => `${where}, post ${j + 1}: ${x}`)),
    ];
  });
  if (broken.length) {
    const fix = prompt("repair", { ...vars, drafts: JSON.stringify({ variants }, null, 2), problems: broken.join("\n") });
    ({ variants } = await ask(Variants, fix.system, fix.user));
  }

  if (new Set(variants.map((v) => v.angle)).size !== ANGLES.length) throw new Error("The model did not return one variant per angle.");
  return saveDrafts(req, variants);
}
