import assert from "node:assert/strict";
import test from "node:test";

process.env.ALIENX_DB = ":memory:";
const { backup, claimDue, createPost, decide, getPost, getTopic, listPosts, saveDrafts, saveTopics, setTopic, setTopicIfFree, takenSlots, updatePost } = await import("../lib/db.ts");

const post = (handle: string, scheduled_at: string) =>
  createPost({ handle, posts: ["hello"], claims: [], source: "seed", scheduled_at });

test("claimDue takes only posts whose slot has come, and only once", () => {
  const past = post("sam_writes", "2026-11-01T10:00:00.000Z");
  const future = post("sam_writes", "2026-11-09T10:00:00.000Z");
  const now = "2026-11-02T00:00:00.000Z";

  assert.deepEqual(claimDue(now).map((p) => p.id), [past.id]);
  assert.deepEqual(claimDue(now), []);
  assert.equal(listPosts("2026-11-09T00:00:00.000Z", "2026-11-10T00:00:00.000Z")[1]?.id, future.id); // the due one stays listed first
});

test("killed posts free their slot and leave the week", () => {
  const p = post("ana_codes", "2026-11-04T08:00:00.000Z");
  assert.ok(takenSlots("ana_codes", "2026-11-01T00:00:00.000Z").includes(p.scheduled_at));
  updatePost(p.id, { status: "killed" });
  assert.deepEqual(takenSlots("ana_codes", "2026-11-01T00:00:00.000Z"), []);
  assert.ok(!listPosts("2026-11-01T00:00:00.000Z", "2026-11-08T00:00:00.000Z").some((x) => x.id === p.id));
});

test("only known fields of a post can be patched", () => {
  const p = post("acme_studio", "2026-11-05T08:00:00.000Z");
  assert.throws(() => updatePost(p.id, { handle: "x" } as never), /cannot be changed/);
});

test("a post alienX booked itself is its pick until someone approves the draft", () => {
  const [d] = saveDrafts({ handle: "acme_studio", seed: "idea", format: "single" }, [{ angle: "story", posts: ["hi"], claims: [] }]);
  const at = "2026-11-06T08:00:00.000Z";
  const p = createPost({ handle: "acme_studio", draft_id: d!.id, posts: ["hi"], claims: [], source: "plan", scheduled_at: at });
  const mine = post("acme_studio", "2026-11-06T12:00:00.000Z");
  const week = () => listPosts("2026-11-06T00:00:00.000Z", "2026-11-07T00:00:00.000Z");
  assert.equal(week().find((x) => x.id === p.id)?.picked, 1);
  assert.equal(week().find((x) => x.id === mine.id)?.picked, 0);
  decide(d!.id, "approved", ["hi"]);
  assert.equal(week().find((x) => x.id === p.id)?.picked, 0);
});

test("getPost and updatePost keep the calendar tags listPosts shows", () => {
  const [d] = saveDrafts({ handle: "acme_studio", seed: "idea", format: "single" }, [{ angle: "story", posts: ["hi"], claims: [] }]);
  const p = createPost({ handle: "acme_studio", draft_id: d!.id, posts: ["hi"], claims: [], source: "plan", scheduled_at: "2026-11-07T08:00:00.000Z" });
  const changed = updatePost(p.id, { posts: ["hello"] });
  assert.equal(changed.picked, 1);
  assert.equal(changed.angle, "story");
  assert.deepEqual(changed.posts, ["hello"]);
  assert.equal(getPost(p.id).picked, 1);
  assert.equal(getPost(p.id).angle, "story");
  assert.throws(() => updatePost(999999, { status: "killed" }), /No post/);
});

test("a failed pick puts its idea back only if nobody decided on it meanwhile", () => {
  const [free, booked, skipped] = saveTopics("acme_studio", "2026-11-02", [1, 2, 3].map((i) => ({ title: `idea ${i}`, angle: "story", why: "now", findings: [] })));
  for (const t of [free!, booked!]) setTopic(t.id, "drafted");
  setTopic(skipped!.id, "skipped");
  const p = createPost({ handle: "acme_studio", topic_id: booked!.id, posts: ["hi"], claims: [], source: "seed", scheduled_at: "2026-11-08T08:00:00.000Z" });
  for (const t of [free!, booked!, skipped!]) setTopicIfFree(t.id);
  assert.equal(getTopic(free!.id).status, "proposed");
  assert.equal(getTopic(booked!.id).status, "drafted");
  assert.equal(getTopic(skipped!.id).status, "skipped");
  updatePost(p.id, { status: "killed" }); // a killed post no longer holds its idea
  setTopicIfFree(booked!.id);
  assert.equal(getTopic(booked!.id).status, "proposed");
});

test("an in-memory database is never backed up", async () => {
  assert.equal(await backup("/nonexistent/backups"), null);
});
