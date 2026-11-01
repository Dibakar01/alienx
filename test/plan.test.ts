import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

// A real file, since an in-memory database is never backed up.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alienx-backup-"));
process.env.ALIENX_DB = path.join(tmp, "alienx.db");
const { backup, createPost, getPost } = await import("../lib/db.ts");

// Windows can't delete the database while this process still has it open; the temp folder is left for the OS.
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

test("the daily backup is a whole copy, one a day, and keeps the newest 7", async () => {
  const dir = path.join(tmp, "backups");
  fs.mkdirSync(dir);
  const days = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];
  for (const d of days) fs.writeFileSync(path.join(dir, `alienx-${d}.db`), "old");
  fs.writeFileSync(path.join(dir, "notes.txt"), "mine");
  const p = createPost({ handle: "acme_studio", posts: ["hi"], claims: [], source: "seed", scheduled_at: "2026-11-02T08:00:00.000Z" });

  const now = new Date("2026-11-01T20:00:00.000Z"); // already 2 Nov in India
  const file = await backup(dir, now);
  assert.equal(file, path.join(dir, "alienx-2026-11-02.db"));
  await backup(dir, now); // a second run the same day replaces that day's copy
  assert.deepEqual(fs.readdirSync(dir).sort(), [...days.slice(2).map((d) => `alienx-${d}.db`), "alienx-2026-11-02.db", "notes.txt"]);

  const copy = new Database(file!, { readonly: true }); // the copy opens and holds the post
  assert.equal((copy.prepare("SELECT posts FROM posts WHERE id = ?").get(p.id) as { posts: string }).posts, JSON.stringify(getPost(p.id).posts));
  copy.close();
});
