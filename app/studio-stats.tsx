"use client";

// The Studio's numbers at a glance, all from the posts on hand and each account's cadence:
// how full each account's week is, what goes out next, what needs you now and what went
// out. A tile that points at a post opens it in one tap. On a phone every tile shows at once:
// cadence and next post side by side, then the three counts in one short row. Under them,
// a full-width row for what alienX suggests next.
import type { Post } from "../lib/db.ts";
import { clock, dayName, local, ZONE } from "../lib/time.ts";
import type { AccountInfo } from "./accounts.tsx";
import { Avatar } from "./avatar.tsx";

// "in 25m", "in 3h 20m", "in 2d 4h".
export function until(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h}h ${m % 60}m` : `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

export function Stats({
  accounts,
  week,
  weekLabel,
  live,
  thisWeek,
  nowMs,
  onOpen,
  children,
}: {
  accounts: AccountInfo[];
  week: Post[]; // the posts in the week on screen
  weekLabel: string;
  live: Post[]; // every post on hand
  thisWeek: (p: Post) => boolean; // whether a post falls in the current Monday-to-Sunday week
  nowMs: number;
  onOpen: (p: Post) => void;
  children?: React.ReactNode; // a full-width row under the tiles: alienX's suggestions
}) {
  const solo = accounts.length === 1;
  const next = live.filter((p) => p.status === "scheduled" && Date.parse(p.scheduled_at) > nowMs).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const due = live.filter((p) => p.status === "due");
  const picks = live.filter((p) => p.status === "scheduled" && p.picked).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const posted = live.filter((p) => p.status === "posted" && thisWeek(p)).length;
  const who = (h: string) => accounts.find((a) => a.handle === h);

  return (
    <section aria-label="This week in numbers" className="rise grid grid-cols-6 gap-2 px-1 pt-1 pb-1 sm:pb-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:gap-3">
      <Tile i={0} r={-0.5} label={`Cadence · ${weekLabel}`} wide>
        <div className={`grid ${solo ? "gap-1" : "gap-0.5"}`}>
          {accounts.map((a) => {
            const mine = week.filter((p) => p.handle === a.handle);
            const out = mine.filter((p) => p.status === "posted").length;
            const goal = a.cadence.per_week;
            return (
              <div key={a.handle} className="flex items-center gap-1.5">
                {!solo && <Avatar who={a} size={16} />}
                {/* One slot per post the account aims for: solid when posted, grey when booked, open when empty. */}
                <span className="flex min-w-0 gap-0.5" aria-hidden="true">
                  {Array.from({ length: Math.max(goal, mine.length) }, (_, i) => (
                    <span key={i} className={`rounded-[2px] ${solo ? "h-3 w-6" : "h-2 w-4"} ${i < out ? "bg-ink" : i < mine.length ? "bg-ink/30" : "border border-strong"}`} />
                  ))}
                </span>
                <span className={`font-semibold tabular-nums ${solo ? "text-lg leading-none" : "text-xs"}`}>
                  <span key={mine.length} className="roll">{mine.length}</span>/{goal}
                </span>
                <span className="sr-only">
                  @{a.handle}: {mine.length} of {goal} booked or posted, {out} posted.
                </span>
              </div>
            );
          })}
          {solo && <span className="text-xs text-muted">booked of {accounts[0]!.cadence.per_week} a week</span>}
        </div>
      </Tile>

      <Tile i={1} r={0.4} label="Next post" onClick={next ? () => onOpen(next) : undefined} wide>
        {next ? (
          <>
            <span key={next.id} className="roll text-xl leading-none font-bold tabular-nums">{until(Date.parse(next.scheduled_at) - nowMs)}</span>
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
              {!solo && who(next.handle) && <Avatar who={who(next.handle)!} size={14} />}
              {dayName(local(new Date(next.scheduled_at), ZONE).day, { weekday: "short", day: "numeric", month: "short" })}, {clock(next.scheduled_at)}
            </span>
          </>
        ) : (
          <>
            <span className="text-xl leading-none font-bold">None</span>
            <span className="text-xs text-muted">nothing booked ahead</span>
          </>
        )}
      </Tile>

      <Tile i={2} r={-0.3} label="Due now" compact hot={due.length > 0} onClick={due[0] ? () => onOpen(due[0]!) : undefined}>
        <span key={due.length} className="roll text-xl leading-none font-bold tabular-nums">{due.length}</span>
        <span className={`text-xs max-sm:hidden ${due.length ? "text-paper" : "text-muted"}`}>{due.length ? "tap to post" : "nothing waiting"}</span>
      </Tile>

      <Tile i={3} r={0.5} label="alienX picks" compact onClick={picks[0] ? () => onOpen(picks[0]!) : undefined}>
        <span key={picks.length} className="roll text-xl leading-none font-bold tabular-nums">{picks.length}</span>
        <span className="text-xs text-muted max-sm:hidden">{picks.length ? "waiting for your yes" : "none to review"}</span>
      </Tile>

      <Tile i={4} r={-0.4} label="Posted" compact>
        <span key={posted} className="roll text-xl leading-none font-bold tabular-nums">{posted}</span>
        <span className="text-xs text-muted max-sm:hidden">this week</span>
      </Tile>

      {children}
    </section>
  );
}

// One number on a scrap of paper; red when it needs you; a button when it leads somewhere.
// A wide tile takes half a phone's width, a compact one a third, with its label beside its number.
function Tile({ i, r, label, hot, wide, compact, onClick, children }: { i: number; r: number; label: string; hot?: boolean; wide?: boolean; compact?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const cls = `grid min-w-0 content-start gap-1 px-3 py-2 text-left md:col-span-1 ${wide ? "col-span-3" : "col-span-2"} ${
    compact ? "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-1.5 max-sm:px-2.5 max-sm:py-1.5" : ""
  } ${hot ? "rounded-card bg-brand text-paper shadow-object" : "sheet text-ink"
  } ${onClick ? "cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none" : ""}`;
  const style = { "--r": `${r}deg`, "--i": i } as React.CSSProperties;
  const body = (
    <>
      <span className={`truncate text-[11px] font-semibold ${hot ? "text-paper" : "text-muted"}`}>{label}</span>
      {children}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}
