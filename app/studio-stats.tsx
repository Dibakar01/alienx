"use client";

// The Studio's numbers in one slim strip, drawn rather than written: a ring per account
// filling toward its week's cadence (posted slots solid), a clock to the next post, then what
// is due and what alienX picked, each as a mark and a count, shown only when there is one. A
// count that points at a post opens it in one tap. Every name is a tooltip and screen-reader
// text. alienX's suggestions are one small button at the end. On a phone the rings take the
// first row and the counts the second.
import type { Post } from "../lib/db.ts";
import { clock, dayName, local, ZONE } from "../lib/time.ts";
import type { AccountInfo } from "./accounts.tsx";
import { Avatar } from "./avatar.tsx";
import { StatusMark } from "./status.tsx";

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
  children?: React.ReactNode; // a row under the strip: alienX's suggestions
}) {
  const next = live.filter((p) => p.status === "scheduled" && Date.parse(p.scheduled_at) > nowMs).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const due = live.filter((p) => p.status === "due");
  const picks = live.filter((p) => p.status === "scheduled" && p.picked).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const nextName = next ? `Next post: @${next.handle}, ${dayName(local(new Date(next.scheduled_at), ZONE).day, { weekday: "short", day: "numeric", month: "short" })}, ${clock(next.scheduled_at)}` : "";

  return (
    <section aria-label="This week in numbers" className="rise grid gap-1.5 px-1 pt-1 pb-1 sm:pb-2">
      <div className="sheet flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-2" style={{ "--r": "-0.2deg", "--i": 0 } as React.CSSProperties}>
        <ul aria-label={`Cadence, ${weekLabel}`} title={`Booked of each week's goal, ${weekLabel}`} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {accounts.map((a) => {
            const mine = week.filter((p) => p.handle === a.handle);
            const out = mine.filter((p) => p.status === "posted").length;
            const goal = a.cadence.per_week;
            const name = `@${a.handle}: ${mine.length} of ${goal} booked or posted, ${out} posted`;
            return (
              <li key={a.handle} title={name} className="flex items-center gap-1.5">
                <Ring booked={mine.length} out={out} goal={goal}>
                  <Avatar who={a} size={24} />
                </Ring>
                <span aria-hidden="true" className="text-xs font-semibold tabular-nums">
                  <span key={mine.length} className="roll">{mine.length}</span>
                  <span className="text-muted">/{goal}</span>
                </span>
                <span className="sr-only">{name}.</span>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1 text-sm font-semibold tabular-nums empty:hidden sm:border-l sm:border-line sm:pl-4">
          {next && (
            <Count label={nextName} onClick={() => onOpen(next)} mark={<ClockIcon />}>
              <span key={next.id} className="roll">{until(Date.parse(next.scheduled_at) - nowMs)}</span>
            </Count>
          )}
          {due.length > 0 && (
            <Count label={`${due.length} due now. Open the first`} hot onClick={() => onOpen(due[0]!)} mark={<StatusMark kind="due" size={12} />}>
              <span key={due.length} className="roll">{due.length}</span>
            </Count>
          )}
          {picks.length > 0 && (
            <Count label={`${picks.length} alienX ${picks.length === 1 ? "pick" : "picks"} waiting for your yes. Open the first`} onClick={() => onOpen(picks[0]!)} mark={<StatusMark kind="pick" size={14} />}>
              <span key={picks.length} className="roll">{picks.length}</span>
            </Count>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

// A ring of one slot per post the account aims for: solid when posted, grey when booked,
// faint when still open. Whatever sits inside (the avatar) is centred in it.
function Ring({ booked, out, goal, children }: { booked: number; out: number; goal: number; children: React.ReactNode }) {
  const slots = Math.max(goal, booked, 1);
  const gap = slots > 1 ? 0.14 : 0;
  return (
    <span className="relative grid size-9 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        {Array.from({ length: slots }, (_, i) => (
          <circle
            key={i}
            cx="18"
            cy="18"
            r="16"
            fill="none"
            strokeWidth="3"
            pathLength={slots}
            strokeDasharray={`${1 - gap} ${slots}`}
            strokeDashoffset={-i - gap / 2}
            className={i < out ? "stroke-ink" : i < booked ? "stroke-ink/40" : "stroke-line"}
          />
        ))}
      </svg>
      {children}
    </span>
  );
}

// One mark and a number; a button when it leads to a post. Its name is the tooltip.
function Count({ label, mark, hot, onClick, children }: { label: string; mark: React.ReactNode; hot?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const cls = `flex items-center gap-1.5 rounded-card px-2 py-1 ${hot ? "text-brand" : "text-ink"}`;
  const body = (
    <>
      <span aria-hidden="true" className="contents">
        {mark}
      </span>
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" title={label} onClick={onClick} className={`${cls} cursor-pointer transition-colors hover:bg-wash motion-reduce:transition-none`}>
      {body}
    </button>
  ) : (
    <span title={label} className={cls}>
      {body}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
      <circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 4v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
