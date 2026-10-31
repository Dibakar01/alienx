import { execFile } from "node:child_process";
import slots from "../config/slots.json" with { type: "json" };
import { claimDue, type Post } from "./db.ts";
import { at, local } from "./time.ts";

export { at, local };

type Window = string[];
type Rules = { weekday: Window[]; weekend: Window[]; per_day: number; gap_min: number; per_week: number };
type Slots = { zone: string; step_min: number; accounts: Record<string, Rules> };
const MIN = 60_000;

export function rules(handle: string, cfg: Slots = slots): Rules {
  return cfg.accounts[handle] ?? cfg.accounts.default!;
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
export function nextSlot(handle: string, from: Date, taken: string[], cfg: Slots = slots): Date {
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
  throw new Error(`No free slot for @${handle} in the next 14 days. Loosen config/slots.json.`);
}

// A post dropped on another day keeps its time of day there. If that moment has passed it
// takes the next free slot instead; if that day or week is already full, the move is refused.
export function moveTo(handle: string, current: string, day: string, now: Date, taken: string[], cfg: Slots = slots): Date {
  const t = at(day, local(new Date(current), cfg.zone).minutes, cfg.zone);
  if (t <= now) return nextSlot(handle, now, taken, cfg);
  const why = full(t, taken.map((s) => new Date(s)), rules(handle, cfg), cfg.zone);
  if (why) throw new Error(why);
  return t;
}

export function osascript(message: string): void {
  // JSON string quoting is also valid AppleScript string quoting.
  execFile("osascript", ["-e", `display notification ${JSON.stringify(message)} with title "alienX" sound name "Glass"`], () => {});
}

// One pass: every post whose slot has come turns due, and one notification names them.
export function tick(now: Date = new Date(), notify: (message: string) => void = osascript): Post[] {
  const due = claimDue(now.toISOString());
  if (due.length) notify(`${due.length === 1 ? "A post is" : `${due.length} posts are`} due: ${[...new Set(due.map((p) => `@${p.handle}`))].join(", ")}. Open alienX to post.`);
  return due;
}
