import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

// The voices and facts are private and not in the public repo; tests that read them run where they exist.
const privateData =
  fs.existsSync(path.join(process.cwd(), "voices", "dibakaarr.json")) && fs.existsSync(path.join(process.cwd(), "knowledge", "qalakaar-facts.md"))
    ? false
    : "needs the private voices/ and knowledge/ files";

// The feedback test writes drafts, so it uses a throwaway in-memory database.
process.env.ALIENX_DB = ":memory:";
// No test may reach the model: if one tried, it would fail on a missing program, not spend usage.
process.env.CLAUDE_BIN = "/nonexistent/claude";

import { POST } from "../app/api/generate/route.ts";
import { decide, recent, saveDrafts } from "../lib/db.ts";
import { context, excerpts } from "../lib/generate.ts";
import { LIMIT, problems, weighted } from "../lib/post.ts";

const off = { hashtags: false, emoji: false };

test("length is counted the way X counts it", () => {
  assert.equal(weighted("a".repeat(280)), 280);
  assert.equal(weighted(`read this https://qalakaar.com/${"x".repeat(200)}`), 10 + 23);
  // A post in X's shape: a short hook line, then the rest after a blank line.
  const shaped = (n: number) => `${"a".repeat(40)}\n\n${"b".repeat(n - 42)}`;
  assert.equal(weighted(shaped(LIMIT)), LIMIT);
  assert.deepEqual(problems(shaped(LIMIT), off), []);
  assert.deepEqual(problems(shaped(LIMIT + 1), off), [`over limit: ${LIMIT + 1} of ${LIMIT}`]);
});

test("each style rule that code can detect is caught", () => {
  assert.deepEqual(problems("we played — and it worked", off), ["em dash"]);
  assert.deepEqual(problems("a night of #bhajan", off), ["hashtag"]);
  assert.deepEqual(problems("a night of #bhajan", { ...off, hashtags: true }), []);
  assert.deepEqual(problems("what a night ✨", off), ["emoji"]);
  assert.deepEqual(problems("what a night ✨", { ...off, emoji: true }), []);
  assert.deepEqual(problems("1/ it started in a room", off), ["thread numbering"]);
  assert.deepEqual(problems("it started in a room (2/5)", off), ["thread numbering"]);
  assert.deepEqual(problems("Here’s the thing about live music", off), ["banned phrase: Here's the thing"]);
  assert.deepEqual(problems("Live music is messy. Agree?", off), ["banned phrase: Agree?"]);
  assert.deepEqual(problems("song no. 3 was the loud one :)", off), []);
});

test("a post is held to X's shape: a short hook, air between beats, no link", () => {
  assert.deepEqual(problems(`${"word ".repeat(22)}\n\nthe rest`, off), ["long hook"]);
  assert.deepEqual(problems("word ".repeat(40).trim(), off), ["long hook", "wall of text"]);
  assert.deepEqual(problems("Short hook.\n\nRead it at https://qalakaar.com", off), ["link in post"]);
  assert.deepEqual(problems("A bhajan was always a pause.\n\nNow everyone calls it a format.", off), []);
});

test("an account's banned words are caught as whole words in any capitalisation", () => {
  const brand = { ...off, banned: ["I", "me", "my", "mine", "myself"] };
  assert.deepEqual(problems("Hear me out, thinker", brand), ["banned word: me"]);
  assert.deepEqual(problems("i’m in, my friend", brand), ["banned word: I", "banned word: my"]);
  assert.deepEqual(problems("we made the time for it, friends. imagine that.", brand), []);
  assert.deepEqual(problems("Hear me out, thinker", off), []);
});

test("excerpts are the paragraphs closest to the seed, one per article, quotes skipped", () => {
  const filler = (word: string) => `${word} `.repeat(30).trim();
  const article = (n: number, ...paragraphs: string[]) => ({ title: `t${n}`, url: `u${n}`, date: "2026-01-01", body: paragraphs.join("\n\n") });
  const corpus = [
    article(1, `Devotional music in a crowded room. ${filler("singing")}`, `> devotional music quoted by someone else ${filler("quote")}`),
    article(2, `Nothing related here at all. ${filler("gardening")}`),
    article(3, `A second devotional paragraph. ${filler("crowd")}`, `More devotional music from the same article. ${filler("again")}`),
    article(4, filler("cooking")),
  ];
  const got = excerpts("devotional music as a shared room", corpus);
  assert.ok(got.length >= 3 && got.length <= 5);
  assert.deepEqual(got.slice(0, 2).map((e) => e.url).sort(), ["u1", "u3"]);
  assert.equal(new Set(got.map((e) => e.url)).size, got.length);
  assert.ok(got.every((e) => !e.text.startsWith("> ")));
});

test("a rejected post and its reason reach the next generation's context", { skip: privateData }, () => {
  const [draft] = saveDrafts({ handle: "dibakaarr", seed: "s", format: "single" }, [{ angle: "story", posts: ["a post that missed"], claims: [] }]);
  decide(draft!.id, "rejected", ["a post that missed, edited"], "sounds like a press release");
  assert.equal(recent("dibakaarr", "rejected")[0]!.reason, "sounds like a press release");
  assert.equal(recent("anshsarkar_", "rejected").length, 0);

  const { vars } = context({ handle: "dibakaarr", seed: "anything", format: "single", hashtags: false });
  assert.match(vars.rejected!, /a post that missed, edited\nRejected because: sounds like a press release/);
  assert.equal(context({ handle: "anshsarkar_", seed: "anything", format: "single", hashtags: false }).vars.rejected, "(none yet)");

  decide(draft!.id, "draft", ["a post that missed, edited"]);
  assert.equal(recent("dibakaarr", "rejected").length, 0);
});

test("each account drafts only in its own pillars", { skip: privateData }, () => {
  const ask = (handle: string, pillar?: string) => context({ handle, seed: "anything", format: "single", hashtags: false, pillar }).vars;
  assert.equal(ask("dibakaarr", "Design").pillar, "Design");
  assert.equal(ask("dibakaarr", "Design").pillars, "Qalakaar, Design, Growth");
  assert.throws(() => ask("anshsarkar_", "Music"), /Music is not a pillar of @anshsarkar_/);
  assert.match(ask("anshsarkar_").pillar, /fits best/);
  assert.equal(ask("iamqalakaar", "Tech").pillar, "Tech");
});

test("only the alienX page can start a generation, and a bad request stops before the model", async () => {
  const call = (origin: string | null, body: unknown) =>
    POST(new Request("http://127.0.0.1:3000/api/generate", { method: "POST", headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }));
  const valid = { handle: "dibakaarr", seed: "a thought", format: "single" };

  for (const origin of ["http://evil.test", "http://127.0.0.1:3000.evil.test", "null", null]) {
    const refused = await call(origin, valid);
    assert.equal(refused.status, 403, `origin ${origin}`);
    assert.deepEqual(await refused.json(), { error: "Refused." });
  }

  const bad = await call("http://127.0.0.1:3000", { handle: "dibakaarr", seed: "   ", format: "single" });
  assert.equal(bad.status, 200);
  const { error } = (await bad.json()) as { error: string };
  assert.ok(error && !/nonexistent|ENOENT|spawn/.test(error), error);
});
