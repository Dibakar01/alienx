import assert from "node:assert/strict";
import test from "node:test";

process.env.ALIENX_DB = ":memory:";
const { claimDue, createPost, listPosts, takenSlots, updatePost } = await import("../lib/db.ts");

const post = (handle: string, scheduled_at: string) =>
  createPost({ handle, posts: ["hello"], claims: [], source: "seed", scheduled_at });

test("claimDue takes only posts whose slot has come, and only once", () => {
  const past = post("dibakaarr", "2026-11-01T10:00:00.000Z");
  const future = post("dibakaarr", "2026-11-09T10:00:00.000Z");
  const now = "2026-11-02T00:00:00.000Z";

  assert.deepEqual(claimDue(now).map((p) => p.id), [past.id]);
  assert.deepEqual(claimDue(now), []);
  assert.equal(listPosts("2026-11-09T00:00:00.000Z", "2026-11-10T00:00:00.000Z")[1]?.id, future.id); // the due one stays listed first
});

test("killed posts free their slot and leave the week", () => {
  const p = post("anshsarkar_", "2026-11-04T08:00:00.000Z");
  assert.ok(takenSlots("anshsarkar_", "2026-11-01T00:00:00.000Z").includes(p.scheduled_at));
  updatePost(p.id, { status: "killed" });
  assert.deepEqual(takenSlots("anshsarkar_", "2026-11-01T00:00:00.000Z"), []);
  assert.ok(!listPosts("2026-11-01T00:00:00.000Z", "2026-11-08T00:00:00.000Z").some((x) => x.id === p.id));
});

test("only known fields of a post can be patched", () => {
  const p = post("iamqalakaar", "2026-11-05T08:00:00.000Z");
  assert.throws(() => updatePost(p.id, { handle: "x" } as never), /cannot be changed/);
});
