import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { claimDue, type Post } from "./db.ts";
import { readLocal } from "./local.ts";
import { notifyCommand } from "./platform.ts";
import { at, local } from "./time.ts";

export { at, local };

type Window = string[];
type Rules = { weekday: Window[]; weekend: Window[]; per_day: number; gap_min: number; per_week: number };
type Slots = { zone: string; step_min: number; accounts: Record<string, Rules> };
const MIN = 60_000;

// The shared defaults with this Mac's own per-handle windows (config/local.json, "slots") laid
// over them. A "zone" key there moves scheduling to another time zone.
export const withLocal = (base: Slots, own: Record<string, unknown> = {}): Slots => {
  const { zone, ...accounts } = own;
  return { ...base, zone: typeof zone === "string" && zone ? zone : base.zone, accounts: { ...base.accounts, ...(accounts as Record<string, Rules>) } };
};
// Read on every call (two small files), so an edit takes effect without restarting the server.
// A file read, not a JSON import, which `next build` would bake in.
const slots = (): Slots =>
  withLocal(JSON.parse(fs.readFileSync(path.join(process.cwd(), "config", "slots.json"), "utf8")) as Slots, readLocal().slots);
// The zone posts are booked in, read once at startup. The pages still show India time (ZONE in lib/time.ts).
export const zone = slots().zone;

export function rules(handle: string, cfg: Slots = slots()): Rules {
  return (Object.hasOwn(cfg.accounts, handle) && cfg.accounts[handle]) || cfg.accounts.default!;
}

const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

const DAY = 24 * 60 * MIN;
// The Monday that starts the calendar week a wall-clock day falls in, as a number to compare.
const weekOf = (day: string) => {
  const d = Date.parse(`${day}T00:00:00Z`);
  return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY;
};

// Why a moment cannot take another post for the account, or null when it can.
function full(t: Date, held: Date[], r: Rules, zone: string): string | null {
  const day = local(t, zone).day;
  if (held.filter((h) => local(h, zone).day === day).length >= r.per_day) return "That day already has its post.";
  if (held.filter((h) => weekOf(local(h, zone).day) === weekOf(day)).length >= r.per_week) return "That week already has its posts.";
  if (held.some((h) => Math.abs(h.getTime() - t.getTime()) < r.gap_min * MIN)) return "Too close to another post.";
  return null;
}

// The first instant from `from` that sits inside one of the account's windows, on a day and
// in a week with room left, and far enough from every slot it already holds. Walks in
// step_min steps. `taken` should reach back a day before `from`, so earlier posts today count.
export function nextSlot(handle: string, from: Date, taken: string[], cfg: Slots = slots()): Date {
  const r = rules(handle, cfg);
  const held = taken.map((s) => new Date(s));
  const step = cfg.step_min * MIN;
  let t = Math.ceil(from.getTime() / step) * step;
  for (const end = t + 14 * 24 * 60 * MIN; t < end; t += step) {
    const when = local(new Date(t), cfg.zone);
    const windows = when.weekend ? r.weekend : r.weekday;
    if (!windows.some(([a, b]) => when.minutes >= hm(a!) && when.minutes < hm(b!))) continue;
    if (full(new Date(t), held, r, cfg.zone)) continue;
    return new Date(t);
  }
  throw new Error(`No free slot for @${handle} in the next 14 days. Loosen its windows under "slots" in config/local.json, or the default in config/slots.json.`);
}

// A post moved to a day by hand stays on that day: the person chose it, so the cadence caps
// (one a day, so many a week) are for alienX's own booking only. It keeps its time of day if
// that is still ahead and clear of the account's other posts; otherwise it takes the free
// moment that day nearest to that time, preferring the account's windows, between 08:00 and
// 23:00. A day that is over, or has no moment far enough from the other posts, is refused.
export function moveTo(handle: string, current: string, day: string, now: Date, taken: string[], cfg: Slots = slots()): Date {
  const r = rules(handle, cfg);
  const held = taken.map((s) => new Date(s).getTime());
  const free = (t: number) => !held.some((h) => Math.abs(h - t) < r.gap_min * MIN);
  const wanted = at(day, local(new Date(current), cfg.zone).minutes, cfg.zone).getTime();
  const end = at(day, 23 * 60, cfg.zone).getTime();
  if (end <= now.getTime()) throw new Error(day === local(now, cfg.zone).day ? "Too late for today. Pick tomorrow or later." : "That day has passed. Pick today or later.");
  if (wanted > now.getTime() && free(wanted)) return new Date(wanted);
  const step = cfg.step_min * MIN;
  const target = Math.max(wanted, now.getTime());
  let best: number | undefined;
  let bestScore = Infinity;
  for (let t = Math.max(at(day, 8 * 60, cfg.zone).getTime(), Math.ceil(now.getTime() / step) * step); t <= end; t += step) {
    if (!free(t)) continue;
    const when = local(new Date(t), cfg.zone);
    const inWindow = (when.weekend ? r.weekend : r.weekday).some(([a, b]) => when.minutes >= hm(a!) && when.minutes < hm(b!));
    const score = (inWindow ? 0 : DAY) + Math.abs(t - target);
    if (score < bestScore) [best, bestScore] = [t, score];
  }
  if (best === undefined) throw new Error("No room that day: every free moment is too close to another post.");
  return new Date(best);
}

// A desktop notification on Mac or Windows. A failed one is ignored.
export function notify(message: string): void {
  const c = notifyCommand(message);
  if (c) execFile(c.cmd, c.args, { windowsHide: true }, () => {});
}

// One pass: every post whose slot has come turns due, and one notification names them.
export function tick(now: Date = new Date(), alert: (message: string) => void = notify): Post[] {
  const due = claimDue(now.toISOString());
  if (due.length) alert(`${due.length === 1 ? "A post is" : `${due.length} posts are`} due: ${[...new Set(due.map((p) => `@${p.handle}`))].join(", ")}. Open alienX to post.`);
  return due;
}
