import assert from "node:assert/strict";
import test from "node:test";
import type { Post, Topic } from "../lib/db.ts";
import { mondayOf, suggest } from "../lib/suggest.ts";

// Saturday 31 Oct 2026, 10:00 IST.
const now = new Date("2026-10-31T04:30:00.000Z");
const account = (handle: string, per_week = 3) => ({ handle, ready: true, cadence: { per_week } });
let n = 0;
const post = (handle: string, scheduled_at: string, extra: Partial<Post> = {}): Post => ({
  id: ++n, handle, draft_id: null, topic_id: null, posts: ["hi"], claims: [], art: { seed: 1 }, source: "seed", status: "scheduled", scheduled_at, posted_at: null, ...extra,
}) as Post;
const topic = (handle: string, title: string): Topic => ({ id: ++n, handle, week: "2026-10-31", title, pillar: null, angle: "story", why: "", findings: [], status: "proposed" }) as Topic;

test("weeks run Monday to Sunday", () => {
  assert.equal(mondayOf("2026-10-31"), "2026-10-26");
  assert.equal(mondayOf("2026-10-26"), "2026-10-26");
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
});

test("due posts come first, then alienX's picks to review", () => {
  const s = suggest([account("a")], [post("a", "2026-11-01T04:30:00.000Z", { picked: 1 }), post("a", "2026-10-31T03:00:00.000Z", { status: "due" })], [], now);
  assert.deepEqual(s.slice(0, 2).map((x) => x.kind), ["due", "review"]);
});

test("a week short of its cadence suggests drafting the best waiting idea for a free day", () => {
  const idea = topic("a", "Small rooms");
  const s = suggest([account("a", 3)], [post("a", "2026-10-27T04:30:00.000Z", { status: "posted" })], [idea, topic("a", "Second")], now);
  const fill = s.find((x) => x.kind === "fill")!;
  assert.deepEqual(fill.action, { type: "draft", topicId: idea.id });
  assert.match(fill.text, /1 of 3 posts this week\. Fill Sunday with "Small rooms"/);
});

test("with no ideas waiting it suggests discovering some", () => {
  const s = suggest([account("a", 3)], [], [], now);
  assert.deepEqual(s.find((x) => x.kind === "fill")?.action, { type: "discover", handle: "a" });
});

test("a full week stays quiet about cadence, but says when ideas run low", () => {
  const posts = ["2026-10-27", "2026-10-29", "2026-11-01"].map((d) => post("a", `${d}T04:30:00.000Z`, { status: d < "2026-10-31" ? "posted" : "scheduled" }));
  const s = suggest([account("a", 3)], posts, [], now);
  assert.equal(s.filter((x) => x.kind === "fill").length, 0);
  assert.equal(s.filter((x) => x.kind === "ideas").length, 1);
});

test("missing pictures and unverified claims on coming posts are flagged, killed posts are not", () => {
  const s = suggest(
    [account("a", 1)],
    [post("a", "2026-11-01T04:30:00.000Z", { art: null, claims: [{ text: "x", source: "unverified" }] }), post("a", "2026-11-01T06:30:00.000Z", { art: null, status: "killed" })],
    [topic("a", "One"), topic("a", "Two")],
    now,
  );
  assert.deepEqual(s.map((x) => x.kind).sort(), ["claims", "picture"]);
});

test("accounts without a voice get no suggestions about cadence", () => {
  assert.deepEqual(suggest([{ handle: "a", ready: false, cadence: { per_week: 3 } }], [], [], now), []);
});
