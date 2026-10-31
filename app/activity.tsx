"use client";

// What alienX is doing right now, in plain sight on every screen. Each job (discovering
// ideas, drafting, drawing a picture, studying a voice) shows as a card just above the
// dock: its moving picture, what it is doing, how long it has run against how long it
// usually takes, and a way to jump to where the work lands. When it ends, the card turns
// into "Done" (or "Stopped") with a View button for a few seconds.
import { useEffect, useState, useSyncExternalStore } from "react";
import { type Kind, Vignette } from "./vignettes.tsx";

// Where a job's result lands, as a step: the ideas, the drafts, or the Studio calendar.
export type Where = "idea" | "drafts" | "week";
// `handle` is the account the job is for, so a profile shows its own work up front.
type Job = { id: number; handle?: string; label: string; kind: Kind; where?: Where; typical: number; since: number };
type Ended = { id: number; handle?: string; text: string; ok: boolean; where?: Where; at: number };
type State = { jobs: Job[]; ended: Ended[] };

let state: State = { jobs: [], ended: [] };
let next = 0;
const subs = new Set<() => void>();
const set = (s: State) => {
  state = s;
  subs.forEach((f) => f());
};
const EMPTY: State = { jobs: [], ended: [] };

// Starts a job. Call the returned function when it ends; give it what to say if it should
// leave a "Done" or "Stopped" card behind.
export function startJob(job: { handle?: string; label: string; kind: Kind; where?: Where; typical: number }): (end?: { text: string; ok: boolean }) => void {
  const id = ++next;
  set({ ...state, jobs: [...state.jobs, { ...job, id, since: Date.now() }] });
  let ended = false;
  return (end) => {
    if (ended) return;
    ended = true;
    const jobs = state.jobs.filter((j) => j.id !== id);
    const done = end ? [...state.ended, { id, handle: job.handle, text: end.text, ok: end.ok, where: job.where, at: Date.now() }] : state.ended;
    set({ jobs, ended: done });
    if (end) setTimeout(() => set({ ...state, ended: state.ended.filter((e) => e.id !== id) }), 7000);
  };
}

function useActivity(): State {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => EMPTY,
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

// Seconds since a moment, ticking once a second.
export function useSeconds(since: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, (now - since) / 1000) : 0;
}
export const useElapsed = (since: number | undefined) => (since ? clock(useSeconds(since)) : "");

function Running({ job, onGo }: { job: Job; onGo?: (w: Where) => void }) {
  const s = useSeconds(job.since);
  const late = s > job.typical * 1.25;
  // An estimate, said as one: the bar fills toward "usual" and waits near the end.
  const fill = Math.min(94, (s / job.typical) * 88);
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3">
      <span className="aspect-[5/3] overflow-hidden rounded-[8px] bg-wash">
        <Vignette kind={job.kind} />
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="truncate text-sm font-semibold">{job.label}</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-wash" aria-hidden="true">
          <span className={`block h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear ${late ? "animate-pulse" : ""}`} style={{ width: `${fill}%` }} />
        </span>
        <span className="text-xs text-muted tabular-nums">
          {clock(s)} · {late ? "taking longer than usual, still working" : `usually about ${clock(job.typical)}`}
        </span>
      </span>
      {job.where && onGo && (
        <button type="button" className="btn px-3 py-1.5 text-xs" onClick={() => onGo(job.where!)}>
          Show
        </button>
      )}
    </div>
  );
}

// A job in one line: what, and for how long.
function Line({ job }: { job: Job }) {
  const s = useSeconds(job.since);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-brand" />
      <span className="min-w-0 flex-1 truncate">{job.label}</span>
      <span className="shrink-0 tabular-nums opacity-70">{clock(s)}</span>
    </span>
  );
}

const Tick = ({ ok }: { ok: boolean }) => (
  <span className={`grid size-6 shrink-0 place-items-center rounded-full ${ok ? "bg-brand" : "bg-snow-line-strong"}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d={ok ? "M5 12.5l4.5 4.5L19 7.5" : "M12 7v6M12 17h.01"} />
    </svg>
  </span>
);

// Inside a profile (`onGo` given): one card above the dock for that profile's work, its first
// job in full and any others as lines under it, plus one quiet line for other accounts.
// Without a place to go (the dial, before anyone is chosen): one small line at the bottom,
// with nothing to press, so it never covers the dial or offers a button that goes nowhere.
export function Activity({ onGo, only }: { onGo?: (w: Where) => void; only?: string }) {
  const { jobs, ended } = useActivity();
  if (!jobs.length && !ended.length) return null;
  const ours = (h?: string) => !h || !only || only === "all" || h === only;

  if (!onGo) {
    const last = ended.at(-1);
    return (
      <p role="status" aria-live="polite" className="fixed bottom-3 left-1/2 z-30 flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-full bg-panel px-4 py-2.5 text-sm text-snow shadow-object">
        {jobs.length ? (
          <>
            <span className="min-w-0 flex-1">
              <Line job={jobs[0]!} />
            </span>
            {jobs.length > 1 && <span className="shrink-0 text-xs text-snow-muted">+{jobs.length - 1} more</span>}
          </>
        ) : last ? (
          <>
            <Tick ok={last.ok} />
            <span className="min-w-0 flex-1 truncate">{last.text}</span>
          </>
        ) : null}
      </p>
    );
  }

  const mine = jobs.filter((j) => ours(j.handle));
  const theirs = jobs.filter((j) => !ours(j.handle));
  const done = ended.filter((e) => ours(e.handle));
  return (
    <div role="status" aria-live="polite" aria-label="What alienX is doing" className="fixed bottom-[5.6rem] left-1/2 z-30 grid w-[min(30rem,calc(100%-1.5rem))] -translate-x-1/2 gap-2">
      {(mine.length > 0 || theirs.length > 0) && (
        <div className="page-in grid gap-2.5 rounded-[14px] border border-line bg-paper p-2.5 pr-3 text-ink shadow-object">
          {mine[0] && <Running key={mine[0].id} job={mine[0]} onGo={onGo} />}
          {mine.slice(1).map((j) => (
            <span key={j.id} className="border-t border-line pt-2 text-xs">
              <Line job={j} />
            </span>
          ))}
          {theirs.length > 0 && (
            <span className={`text-xs text-muted ${mine.length ? "border-t border-line pt-2" : ""}`}>
              Also working for {[...new Set(theirs.map((j) => (j.handle ? `@${j.handle}` : "another account")))].join(", ")}.
            </span>
          )}
        </div>
      )}
      {done.map((e) => (
        <div key={e.id} className="page-in flex items-center gap-3 rounded-[14px] bg-panel px-3.5 py-2.5 text-sm text-snow shadow-object">
          <Tick ok={e.ok} />
          <span className="min-w-0 flex-1 truncate">{e.text}</span>
          {e.where && (
            <button type="button" className="font-semibold underline underline-offset-4" onClick={() => onGo(e.where!)}>
              View
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
