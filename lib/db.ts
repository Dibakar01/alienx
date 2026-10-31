import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Claim = { text: string; source: "facts" | "seed" | "research" | "unverified" };
export type Status = "draft" | "approved" | "rejected";
export type Draft = { id: number; handle: string; angle: string; posts: string[]; claims: Claim[]; status: Status; reason: string | null };

// Opened on first use, so importing this file never touches the disk.
let cached: Database.Database | undefined;
function db(): Database.Database {
  if (cached) return cached;
  const file = process.env.ALIENX_DB ?? path.join(process.cwd(), "data", "alienx.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  cached = new Database(file);
  cached.exec(`CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY,
    handle TEXT NOT NULL,
    seed TEXT NOT NULL,
    format TEXT NOT NULL,
    pillar TEXT,
    angle TEXT NOT NULL,
    posts TEXT NOT NULL,
    claims TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  )`);
  // A post on the schedule. Times are UTC ISO strings, so text order is time order.
  // scheduled: waiting for its slot · due: the slot came, waiting for the owner's tap ·
  // posted: the owner posted it · killed: vetoed. The image lives at data/art/<id>.png.
  cached.exec(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    handle TEXT NOT NULL,
    draft_id INTEGER,
    topic_id INTEGER,
    posts TEXT NOT NULL,
    claims TEXT NOT NULL,
    art TEXT,
    source TEXT NOT NULL CHECK (source IN ('seed', 'plan')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'due', 'posted', 'killed')),
    scheduled_at TEXT NOT NULL,
    posted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  // A topic the weekly research proposed for an account, with the findings behind it.
  cached.exec(`CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY,
    handle TEXT NOT NULL,
    week TEXT NOT NULL,
    title TEXT NOT NULL,
    pillar TEXT,
    angle TEXT NOT NULL,
    why TEXT NOT NULL,
    findings TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'drafted', 'skipped')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  return cached;
}

type Row = Omit<Draft, "posts" | "claims"> & { posts: string; claims: string };
const toDraft = (r: Row): Draft => ({ ...r, posts: JSON.parse(r.posts), claims: JSON.parse(r.claims) });
const COLUMNS = "id, handle, angle, posts, claims, status, reason";

export function saveDrafts(
  meta: { handle: string; seed: string; format: string; pillar?: string },
  variants: { angle: string; posts: string[]; claims: Claim[] }[],
): Draft[] {
  const insert = db().prepare(
    `INSERT INTO drafts (handle, seed, format, pillar, angle, posts, claims) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`,
  );
  return variants.map((v) =>
    toDraft(insert.get(meta.handle, meta.seed, meta.format, meta.pillar ?? null, v.angle, JSON.stringify(v.posts), JSON.stringify(v.claims)) as Row),
  );
}

// Approve, reject or undo. The posts saved are the ones on screen, edits included.
export function decide(id: number, status: Status, posts: string[], reason?: string): void {
  const done = db()
    .prepare("UPDATE drafts SET status = ?, posts = ?, reason = ?, decided_at = datetime('now') WHERE id = ?")
    .run(status, JSON.stringify(posts), status === "rejected" ? (reason ?? null) : null, id);
  if (!done.changes) throw new Error(`No draft with id ${id}`);
}

// The account's latest approved or rejected posts, newest first.
export function recent(handle: string, status: Status, limit = 10): Draft[] {
  const rows = db()
    .prepare(`SELECT ${COLUMNS} FROM drafts WHERE handle = ? AND status = ? ORDER BY decided_at DESC, id DESC LIMIT ?`)
    .all(handle, status, limit) as Row[];
  return rows.map(toDraft);
}

export type Finding = { claim: string; url: string; title: string };
export type PostStatus = "scheduled" | "due" | "posted" | "killed";
export type Post = {
  id: number;
  handle: string;
  draft_id: number | null;
  topic_id: number | null;
  posts: string[];
  claims: Claim[];
  art: unknown;
  source: "seed" | "plan";
  status: PostStatus;
  scheduled_at: string;
  posted_at: string | null;
  // Tags for the calendar, filled by listPosts from the draft and topic it came from.
  angle?: string | null;
  pillar?: string | null;
  // alienX booked it itself (its daily pick or a full plan run) and nobody has approved it yet.
  picked?: number;
};
type PostRow = Omit<Post, "posts" | "claims" | "art"> & { posts: string; claims: string; art: string | null };
const toPost = (r: PostRow): Post => ({ ...r, posts: JSON.parse(r.posts), claims: JSON.parse(r.claims), art: r.art ? JSON.parse(r.art) : null });
const POST_COLUMNS = "id, handle, draft_id, topic_id, posts, claims, art, source, status, scheduled_at, posted_at";

export function createPost(p: {
  handle: string;
  posts: string[];
  claims: Claim[];
  source: Post["source"];
  scheduled_at: string;
  draft_id?: number;
  topic_id?: number;
}): Post {
  const row = db()
    .prepare(
      `INSERT INTO posts (handle, draft_id, topic_id, posts, claims, source, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${POST_COLUMNS}`,
    )
    .get(p.handle, p.draft_id ?? null, p.topic_id ?? null, JSON.stringify(p.posts), JSON.stringify(p.claims), p.source, p.scheduled_at);
  return toPost(row as PostRow);
}

export function getPost(id: number): Post {
  const row = db().prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE id = ?`).get(id) as PostRow | undefined;
  if (!row) throw new Error(`No post with id ${id}`);
  return toPost(row);
}

// Everything not killed whose slot falls in [from, to), plus anything still due from before.
export function listPosts(from: string, to: string): Post[] {
  const rows = db()
    .prepare(
      `SELECT ${POST_COLUMNS.split(", ").map((c) => `p.${c}`).join(", ")}, d.angle AS angle, COALESCE(d.pillar, t.pillar) AS pillar,
              (p.source = 'plan' AND COALESCE(d.status, '') != 'approved') AS picked
       FROM posts p LEFT JOIN drafts d ON d.id = p.draft_id LEFT JOIN topics t ON t.id = p.topic_id
       WHERE p.status != 'killed' AND ((p.scheduled_at >= ? AND p.scheduled_at < ?) OR p.status = 'due') ORDER BY p.scheduled_at`,
    )
    .all(from, to) as PostRow[];
  return rows.map(toPost);
}

// The slots an account already holds from a moment on, so a new post never collides.
export function takenSlots(handle: string, from: string, except?: number): string[] {
  const rows = db()
    .prepare(`SELECT scheduled_at FROM posts WHERE handle = ? AND status != 'killed' AND scheduled_at >= ? AND id != ?`)
    .all(handle, from, except ?? -1) as { scheduled_at: string }[];
  return rows.map((r) => r.scheduled_at);
}

const PATCHABLE = new Set(["posts", "claims", "art", "status", "scheduled_at", "posted_at"]);
export function updatePost(
  id: number,
  patch: Partial<Pick<Post, "posts" | "claims" | "art" | "status" | "scheduled_at" | "posted_at">>,
): Post {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!PATCHABLE.has(key)) throw new Error(`A post's ${key} cannot be changed`);
    sets.push(`${key} = ?`);
    values.push(key === "posts" || key === "claims" || key === "art" ? JSON.stringify(value) : (value as string | null));
  }
  if (!sets.length) return getPost(id);
  const row = db()
    .prepare(`UPDATE posts SET ${sets.join(", ")} WHERE id = ? RETURNING ${POST_COLUMNS}`)
    .get(...values, id) as PostRow | undefined;
  if (!row) throw new Error(`No post with id ${id}`);
  return toPost(row);
}

// Moves every scheduled post whose slot has come to due, and returns exactly those. One
// statement, so two ticks running at once can never both claim the same post.
export function claimDue(now: string): Post[] {
  const rows = db()
    .prepare(`UPDATE posts SET status = 'due' WHERE status = 'scheduled' AND scheduled_at <= ? RETURNING ${POST_COLUMNS}`)
    .all(now) as PostRow[];
  return rows.map(toPost);
}

export type TopicStatus = "proposed" | "drafted" | "skipped";
export type Topic = {
  id: number;
  handle: string;
  week: string;
  title: string;
  pillar: string | null;
  angle: string;
  why: string;
  findings: Finding[];
  status: TopicStatus;
};
type TopicRow = Omit<Topic, "findings"> & { findings: string };
const toTopic = (r: TopicRow): Topic => ({ ...r, findings: JSON.parse(r.findings) });
const TOPIC_COLUMNS = "id, handle, week, title, pillar, angle, why, findings, status";

export function saveTopics(
  handle: string,
  week: string,
  topics: { title: string; pillar?: string; angle: string; why: string; findings: Finding[] }[],
): Topic[] {
  const insert = db().prepare(
    `INSERT INTO topics (handle, week, title, pillar, angle, why, findings) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${TOPIC_COLUMNS}`,
  );
  return topics.map((t) =>
    toTopic(insert.get(handle, week, t.title, t.pillar ?? null, t.angle, t.why, JSON.stringify(t.findings)) as TopicRow),
  );
}

export function getTopic(id: number): Topic {
  const row = db().prepare(`SELECT ${TOPIC_COLUMNS} FROM topics WHERE id = ?`).get(id) as TopicRow | undefined;
  if (!row) throw new Error(`No topic with id ${id}`);
  return toTopic(row);
}

export function listTopics(status: TopicStatus): Topic[] {
  const rows = db().prepare(`SELECT ${TOPIC_COLUMNS} FROM topics WHERE status = ? ORDER BY id DESC`).all(status) as TopicRow[];
  return rows.map(toTopic);
}

export function setTopic(id: number, status: TopicStatus): void {
  const done = db().prepare("UPDATE topics SET status = ? WHERE id = ?").run(status, id);
  if (!done.changes) throw new Error(`No topic with id ${id}`);
}
