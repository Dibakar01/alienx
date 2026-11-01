import assert from "node:assert/strict";
import test from "node:test";

process.env.ALIENX_DB = ":memory:";
const { at, local, moveTo, nextSlot, tick } = await import("../lib/schedule.ts");
const { createPost } = await import("../lib/db.ts");

const cfg = {
  zone: "Asia/Kolkata",
  step_min: 15,
  accounts: { a: { weekday: [["12:30", "14:00"]], weekend: [["18:00", "19:00"]], per_day: 1, gap_min: 180, per_week: 3 } },
};
const ist = (iso: string) => {
  const l = local(new Date(iso), "Asia/Kolkata");
  return `${l.day} ${String(Math.floor(l.minutes / 60)).padStart(2, "0")}:${String(l.minutes % 60).padStart(2, "0")}`;
};

test("slots are read in IST, not UTC", () => {
  // Monday 2026-11-02 07:00 UTC is 12:30 IST, the window opens exactly then.
  assert.equal(ist(nextSlot("a", new Date("2026-11-02T06:50:00Z"), [], cfg).toISOString()), "2026-11-02 12:30");
  assert.equal(at("2026-11-02", 12 * 60 + 30, "Asia/Kolkata").toISOString(), "2026-11-02T07:00:00.000Z");
});

test("a day that already has its post is skipped", () => {
  const held = [at("2026-11-02", 13 * 60, "Asia/Kolkata").toISOString()];
  assert.equal(ist(nextSlot("a", new Date("2026-11-02T06:50:00Z"), held, cfg).toISOString()), "2026-11-03 12:30");
});

test("the gap is kept across midnight and the weekend window is used", () => {
  // Friday 2026-11-06 after the window: Saturday's window is 18:00 IST.
  assert.equal(ist(nextSlot("a", new Date("2026-11-06T09:00:00Z"), [], cfg).toISOString()), "2026-11-07 18:00");
  const roomy = { ...cfg, accounts: { a: { ...cfg.accounts.a, per_day: 3 } } };
  const held = [at("2026-11-02", 12 * 60 + 30, "Asia/Kolkata").toISOString()];
  assert.equal(ist(nextSlot("a", new Date("2026-11-02T06:50:00Z"), held, roomy).toISOString()), "2026-11-03 12:30"); // 13:00-13:45 sit inside the 3h gap
});

test("a post dropped on another day keeps its time there; a day that is over is refused", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  const current = at("2026-11-03", 13 * 60, "Asia/Kolkata").toISOString();
  assert.equal(ist(moveTo("a", current, "2026-11-05", now, [], cfg).toISOString()), "2026-11-05 13:00");
  assert.throws(() => moveTo("a", current, "2026-11-01", now, [], cfg), /That day has passed/);
});

test("a full week waits for the next one", () => {
  const busy = { ...cfg, accounts: { a: { ...cfg.accounts.a, per_week: 2 } } };
  // Mon 2 and Tue 3 Nov hold posts: the rest of that week is full, so the next slot is Mon 9.
  const held = ["2026-11-02", "2026-11-03"].map((d) => at(d, 13 * 60, "Asia/Kolkata").toISOString());
  assert.equal(ist(nextSlot("a", new Date("2026-11-03T12:00:00Z"), held, busy).toISOString()), "2026-11-09 12:30");
});

test("a post earlier today still counts, so a second one waits for tomorrow", () => {
  const earlier = [at("2026-11-02", 12 * 60 + 30, "Asia/Kolkata").toISOString()];
  assert.equal(ist(nextSlot("a", new Date("2026-11-02T08:00:00Z"), earlier, cfg).toISOString()), "2026-11-03 12:30");
});

test("a drop on a day that already has a post stays on that day, clear of the other post", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  const current = at("2026-11-03", 13 * 60, "Asia/Kolkata").toISOString();
  const held = [at("2026-11-05", 12 * 60 + 45, "Asia/Kolkata").toISOString()];
  // A day that already has a post still takes a moved one; it shifts clear of the other post.
  const moved = moveTo("a", current, "2026-11-05", now, held, cfg);
  assert.equal(local(moved, "Asia/Kolkata").day, "2026-11-05");
  assert.ok(Math.abs(moved.getTime() - Date.parse(held[0]!)) >= 180 * 60_000);
});

test("moving a post to today keeps it today, even when its time has passed and today has a post", () => {
  // Sunday 1 Nov, 09:40 IST. The account already posts at 10:00 today; this post sat at 08:30 on Wednesday.
  const now = new Date("2026-11-01T04:10:00Z");
  const current = at("2026-11-04", 8 * 60 + 30, "Asia/Kolkata").toISOString();
  const held = [at("2026-11-01", 10 * 60, "Asia/Kolkata").toISOString()];
  const moved = moveTo("a", current, "2026-11-01", now, held, cfg);
  assert.equal(local(moved, "Asia/Kolkata").day, "2026-11-01");
  assert.ok(moved > now);
  // Sunday's window is 18:00 to 19:00, and it is free: the moved post takes it.
  assert.equal(ist(moved.toISOString()), "2026-11-01 18:00");
});

test("late at night today is refused with a clear reason", () => {
  const now = new Date("2026-11-01T18:00:00Z"); // 23:30 IST
  const current = at("2026-11-04", 13 * 60, "Asia/Kolkata").toISOString();
  assert.throws(() => moveTo("a", current, "2026-11-01", now, [], cfg), /Too late for today/);
});

test("a tick notifies once for posts that came due, and the next tick stays quiet", () => {
  createPost({ handle: "sam_writes", posts: ["x"], claims: [], source: "seed", scheduled_at: "2026-11-02T03:00:00.000Z" });
  createPost({ handle: "sam_writes", posts: ["y"], claims: [], source: "seed", scheduled_at: "2026-11-09T03:00:00.000Z" });
  const said: string[] = [];
  const now = new Date("2026-11-02T04:00:00Z");
  assert.equal(tick(now, (m) => said.push(m)).length, 1);
  assert.equal(tick(now, (m) => said.push(m)).length, 0);
  assert.deepEqual(said, ["A post is due: @sam_writes. Open alienX to post."]);
});
