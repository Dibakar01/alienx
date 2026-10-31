"use client";

// The Studio: a real calendar of posts. A Monday-to-Sunday week in India time on one torn
// sheet, a column per day and an hour axis down the side, each post placed at its time of
// day. Each account's posting windows are shaded, so an open slot reads as open, and a red
// line marks now. Numbers sit above it. A card can be dragged to another day (it keeps its
// time there) and settles on One Flow's spring; a tap opens it. On a phone one day shows at
// a time, and a card dropped on a day chip moves to that day. alienX's suggestions sit under
// the numbers, and an account short of its week gets one pencilled slot: what alienX would
// draft there, a tap away. A pencilled slot is a suggestion, never a post, and takes no drops.
import { useLayoutEffect, useRef, useState, useEffect, useTransition } from "react";
import type { Finding, Post, Topic } from "../lib/db.ts";
import type { Suggestion } from "../lib/suggest.ts";
import { addDays, at, clock, dayName, local, ZONE } from "../lib/time.ts";
import type { AccountInfo } from "./accounts.tsx";
import { changePostAction } from "./actions.ts";
import { Avatar } from "./avatar.tsx";
import { Mascot } from "./mascot.tsx";
import { PostDetail } from "./post-detail.tsx";
import { Stats } from "./studio-stats.tsx";
import { Suggestions, useSuggestions } from "./studio-suggest.tsx";
import { ViewTitle } from "./title.tsx";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const spring = (token = "--spring") => (typeof window === "undefined" ? "ease-out" : getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "ease-out");

const HOUR = 40; // pixels per hour on the time grid
const CARD = 60; // pixels a card stands on it
const SPAN = (CARD / HOUR) * 60; // the minutes a card covers, for spotting cards that overlap
const STEP = 14; // pixels each overlapping card steps right of the one under it
// How many days back app/page.tsx loads posts (listPosts from today minus this). Days before
// that are marked "not loaded" rather than shown as empty. Keep the two in step.
const BACK = 14;

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 is Sunday
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "am" : "pm"}`;
const short = (day: string) => dayName(day, { day: "numeric", month: "short" });

// Cards that would overlap on a day are dealt into lanes; each lane steps a little to the right
// and sits on top of the one before, so every card keeps nearly the full width of its day.
// At the same time, a posted card is dealt first so it sits underneath one that still needs you.
function lanes(items: { id: number; at: number; done: boolean }[]) {
  const out = new Map<number, { lane: number; of: number }>();
  let group: number[] = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const id of group) out.get(id)!.of = ends.length;
    group = [];
    ends = [];
  };
  for (const it of [...items].sort((a, b) => a.at - b.at || Number(b.done) - Number(a.done))) {
    if (it.at >= groupEnd) close();
    let lane = ends.findIndex((e) => e <= it.at);
    if (lane < 0) lane = ends.push(0) - 1;
    ends[lane] = it.at + SPAN;
    groupEnd = Math.max(groupEnd, it.at + SPAN);
    group.push(it.id);
    out.set(it.id, { lane, of: 1 });
  }
  close();
  return out;
}

// Where a card was when it was dropped, so it can travel from there into its new cell.
const flights = new Map<number, DOMRect>();

export function Week({
  accounts,
  posts,
  topics,
  sources,
  now,
  onAbout,
  onCreate,
  onDraft,
}: {
  accounts: AccountInfo[];
  posts: Post[];
  topics: Topic[];
  sources: Record<number, Finding[]>;
  now: string;
  onAbout?: () => void;
  onCreate?: () => void;
  onDraft?: (topicId: number) => void; // opens Create and drafts that idea
}) {
  // The page is rendered once; a client clock keeps the now line and "next post" moving.
  const [nowMs, setNowMs] = useState(() => Date.parse(now));
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const here = local(new Date(nowMs), ZONE);
  const today = here.day;
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const todayAt = (weekday(today) + 6) % 7;

  const [offset, setOffset] = useState(0); // weeks from this one: last week to two ahead
  // On a phone one day shows: today if something is still coming today, else the next day
  // this week that holds a post, so the next thing to do is what opens.
  const nextAt = (() => {
    const coming = posts.filter((p) => p.status === "due" || (p.status === "scheduled" && p.scheduled_at >= new Date(nowMs).toISOString()));
    for (let i = todayAt; i < 7; i++) {
      const d = addDays(monday, i);
      if (coming.some((p) => (p.status === "due" ? today : local(new Date(p.scheduled_at), ZONE).day) === d)) return i;
    }
    return todayAt;
  })();
  const [pick, setPick] = useState(nextAt); // the day shown on a phone
  const [moved, setMoved] = useState<Record<number, string>>({}); // optimistic slots while a move saves
  const [gone, setGone] = useState<Record<number, boolean>>({}); // killed, until undone
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Post | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const body = useRef<HTMLDivElement>(null);

  const first = addDays(monday, offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const live = posts.filter((p) => !gone[p.id]).map((p) => (moved[p.id] ? { ...p, scheduled_at: moved[p.id]! } : p));
  // A post still due from before today shows on today's column, so it is never lost.
  const dayOf = (p: Post) => {
    const d = local(new Date(p.scheduled_at), ZONE).day;
    return p.status === "due" && d < today ? today : d;
  };
  const minuteOf = (p: Post) => local(new Date(p.scheduled_at), ZONE).minutes;
  const week = live.filter((p) => days.includes(dayOf(p)));
  const solo = accounts.length === 1;
  const windows = (a: AccountInfo, d: string) => (weekday(d) === 0 || weekday(d) === 6 ? a.cadence.weekend : a.cadence.weekday);

  // The hour axis covers every posting window and every post this week, at least 8 am to 11 pm.
  const marks = [...accounts.flatMap((a) => [...a.cadence.weekday, ...a.cadence.weekend].flat().map(minutes)), ...week.map(minuteOf)];
  const from = Math.floor(Math.min(8 * 60, ...marks) / 60);
  const to = Math.min(24, Math.ceil(Math.max(23 * 60, ...marks.map((m) => m + 30)) / 60));
  const height = (to - from) * HOUR;
  const y = (m: number) => ((m - from * 60) / 60) * HOUR;
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  // Open where the next thing is: this week, the earlier of now and the next post's time of
  // day (so a post tomorrow morning is in view late tonight); other weeks, their first post;
  // else the first window.
  const firstMark = week.length ? Math.min(...week.map(minuteOf)) : Math.min(...marks, 9 * 60);
  const coming = week.filter((p) => p.status === "due" || (p.status === "scheduled" && dayOf(p) >= today));
  const nowMark = coming.length ? Math.min(here.minutes, ...coming.map(minuteOf)) : here.minutes;
  const target = (offset === 0 ? y(nowMark) : y(firstMark)) - HOUR;
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    // The view may be mounted hidden; place the scroll the first time it has a size.
    let seen = el.clientHeight > 0;
    if (seen) el.scrollTop = Math.max(0, target);
    const ro = new ResizeObserver(() => {
      if (seen || !el.clientHeight) return;
      seen = true;
      el.scrollTop = Math.max(0, target);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // Only on arrival and when the week changes, never while someone is scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const page = (n: number) => {
    setOffset(n);
    setPick(n === 0 ? nextAt : 0);
  };
  const weekName = ["Last week", "This week", "Next week", "In two weeks"][offset + 1]!;
  // Posts are only loaded from BACK days ago, so last week can be partly unknown.
  const loaded = addDays(today, -BACK);
  const partial = first < loaded;

  const say = (text: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setToast({ text, undo });
    timer.current = setTimeout(() => setToast(null), 10_000);
  };

  const move = (p: Post, day: string, from: DOMRect) => {
    if (day === dayOf(p)) return;
    // Keeps its time of day on the new day; the server picks the next free slot if that has passed.
    const guess = at(day, minuteOf(p), ZONE).toISOString();
    flights.set(p.id, from);
    setMoved((m) => ({ ...m, [p.id]: guess }));
    start(async () => {
      const r = await changePostAction({ do: "move", id: p.id, day });
      // Either way the guess goes: on success the server's refreshed posts carry the new slot.
      setMoved((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) !== p.id)));
      if (r.error || !r.post) say(`Not moved. ${r.error ?? ""}`);
      else say(`Moved to ${dayName(local(new Date(r.post.scheduled_at), ZONE).day)}, ${clock(r.post.scheduled_at)}.`);
    });
  };

  const kill = (p: Post) => {
    setGone((g) => ({ ...g, [p.id]: true }));
    setOpen(null);
    start(async () => {
      const r = await changePostAction({ do: "kill", id: p.id });
      if (r.error) {
        setGone((g) => ({ ...g, [p.id]: false }));
        return say(`Not killed. ${r.error}`);
      }
      say("Post killed.", () =>
        start(async () => {
          await changePostAction({ do: "restore", id: p.id });
          setGone((g) => ({ ...g, [p.id]: false }));
          setToast(null);
        }),
      );
    });
  };

  // What alienX suggests, and doing it: open the post, draft the idea in Create, or discover ideas.
  const suggestions = useSuggestions(accounts, live, topics, nowMs, today);
  const list = suggestions.list.filter((s) => s.action.type !== "draft" || onDraft);
  const act = (s: Suggestion) => {
    const a = s.action;
    if (a.type === "open") {
      const p = live.find((p) => p.id === a.postId);
      if (p) setOpen(p);
    } else if (a.type === "draft") onDraft?.(a.topicId);
    else void suggestions.discover(a.handle);
  };
  // One pencilled slot per account short of its week (the fill suggestion, so dismissing that
  // hides it too), on the first free day from tomorrow to Sunday.
  const ghosts =
    offset !== 0
      ? []
      : list.flatMap((s, i) => {
          const a = accounts.find((a) => a.handle === s.handle);
          if (s.kind !== "fill" || !a) return [];
          const taken = (d: string) => live.some((p) => p.handle === a.handle && p.status !== "killed" && local(new Date(p.scheduled_at), ZONE).day === d);
          const day = thisWeek.find((d) => d > today && !taken(d));
          if (!day) return [];
          // The first window no booked card sits across, so the pencilled slot is never hidden under one.
          const booked = live.filter((p) => dayOf(p) === day).map(minuteOf);
          const open = windows(a, day).map(([s]) => minutes(s!));
          const at = open.find((m) => booked.every((b) => Math.abs(b - m) >= SPAN)) ?? open[0];
          if (at === undefined) return [];
          const go = s.action;
          const title = go.type === "draft" ? (topics.find((t) => t.id === go.topicId)?.title ?? "draft an idea") : "discover ideas";
          return [{ id: -(i + 1), handle: a.handle, day, at, title, s, busy: go.type === "discover" && Boolean(suggestions.finding[go.handle]) }];
        });

  const cols = "grid grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[3rem_repeat(7,minmax(0,1fr))]";

  return (
    <div className="mx-auto grid h-full w-full max-w-7xl grid-rows-[auto_auto_minmax(0,1fr)] gap-2 p-2 pb-24 sm:gap-3 sm:p-3 sm:pb-24 lg:px-8 lg:pt-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:pr-14">
        <button type="button" onClick={onAbout} aria-label="About alienX" className="rounded-full">
          <Mascot className="size-8 text-brand" />
        </button>
        <div className="min-w-0">
          <ViewTitle name="Studio" who={solo ? accounts[0]!.name : accounts.length === 3 ? "all three" : "all accounts"} />
          <p className="text-sm text-snow-muted max-sm:hidden">Tap a post to open it. Drag it to another day.</p>
        </div>
        <div className="flex items-center gap-2 max-sm:mt-1.5 max-sm:w-full sm:ml-auto">
          <div className="flex items-center gap-1" role="group" aria-label="Week">
            <button type="button" className="btn btn-ground px-2.5 py-1.5" onClick={() => page(offset - 1)} disabled={offset <= -1} aria-label="Earlier week">
              <span aria-hidden="true">&larr;</span>
              <span className="ml-1 max-sm:hidden">Earlier</span>
            </button>
            <button
              type="button"
              onClick={() => page(0)}
              aria-label={`${weekName}, ${short(first)} to ${short(days[6]!)}${offset ? ". Back to this week" : ""}`}
              className="grid min-w-28 justify-items-center rounded-card px-2 py-0.5 leading-tight text-snow hover:bg-panel"
            >
              <span className={`text-[11px] font-semibold ${offset === 0 ? "text-brand" : "text-snow-muted"}`}>{weekName}</span>
              <span className="text-sm font-semibold tabular-nums">
                {short(first)} – {short(days[6]!)}
              </span>
            </button>
            <button type="button" className="btn btn-ground px-2.5 py-1.5" onClick={() => page(offset + 1)} disabled={offset >= 2} aria-label="Later week">
              <span className="mr-1 max-sm:hidden">Later</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
          {onCreate && (
            <button type="button" className="btn btn-primary ml-auto gap-1.5 whitespace-nowrap max-sm:px-3 sm:ml-2" onClick={onCreate}>
              <span aria-hidden="true" className="text-base leading-none">+</span> New post
            </button>
          )}
        </div>
      </header>

      <Stats
        accounts={accounts}
        week={week}
        weekLabel={partial ? `since ${short(loaded)}` : weekName.toLowerCase()}
        live={live}
        thisWeek={(p) => thisWeek.includes(dayOf(p))}
        nowMs={nowMs}
        onOpen={setOpen}
      >
        <Suggestions list={list.filter((x) => x.kind !== "due" && x.kind !== "review")} finding={suggestions.finding} onAct={act} onDismiss={suggestions.dismiss} />
      </Stats>

      <main className="sheet tape mt-1 flex min-h-0 flex-col gap-2 p-2 sm:p-4">
        {week.length === 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm">
            <p className="text-muted">
              {offset < 0 ? (partial ? `Nothing went out from ${short(loaded)}.` : "Nothing went out that week.") : `Nothing booked ${offset === 0 ? "this week" : "that week"} yet. The shaded bands are open slots.`}
            </p>
            {offset >= 0 && onCreate && (
              <button type="button" className="btn btn-dark px-3 py-1" onClick={onCreate}>
                New post
              </button>
            )}
          </div>
        )}

        {/* Phone: the seven days as chips; the chosen one is shown below. Cards can be dropped on a chip. */}
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] sm:hidden" role="tablist" aria-label="Day">
          {days.map((d, i) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={pick === i}
              data-day={d}
              onClick={() => setPick(i)}
              className={`pill min-w-11 flex-1 shrink-0 rounded-card border px-1 py-1 text-xs font-semibold ${
                pick === i ? "border-ink bg-ink text-paper" : over === d ? "border-brand text-brand" : d === today ? "border-brand text-brand" : "border-line text-muted"
              } ${d < today && pick !== i ? "opacity-60" : ""}`}
            >
              {dayName(d, { weekday: "short" })}
              <span className="block text-sm tabular-nums">{dayName(d, { day: "numeric" })}</span>
              {/* A dot under each day that holds a post: red when one is due. */}
              <span
                aria-hidden="true"
                className={`mx-auto mt-0.5 block size-1.5 rounded-full ${
                  live.some((p) => dayOf(p) === d && p.status === "due")
                    ? "bg-brand"
                    : live.some((p) => dayOf(p) === d)
                      ? pick === i
                        ? "bg-paper"
                        : "bg-ink"
                      : ghosts.some((g) => g.day === d)
                        ? `border border-dashed ${pick === i ? "border-paper" : "border-pencil"}`
                        : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>

        <div ref={body} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[6px]">
          {/* Day headers, pinned while the hours scroll under them. */}
          <div className={`${cols} sticky top-0 z-20 bg-paper max-sm:hidden`}>
            <span className="border-b border-line" />
            {days.map((d) => (
              <div key={d} data-day={d} className={`flex items-center gap-2 border-b border-line px-2 pt-1 pb-2 ${d < today ? "opacity-50" : ""} ${over === d ? "drop-here" : ""}`}>
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-xl font-bold tabular-nums ${d === today ? "bg-brand text-paper" : ""}`}
                  aria-current={d === today ? "date" : undefined}
                >
                  {dayName(d, { day: "numeric" })}
                </span>
                <span className="grid leading-tight">
                  <span className={`text-xs font-semibold uppercase ${d === today ? "text-brand" : "text-muted"}`}>{dayName(d, { weekday: "short" })}</span>
                  {d === today && <span className="text-[11px] text-brand">today</span>}
                  {d < loaded && <span className="text-[11px] text-muted">not loaded</span>}
                </span>
              </div>
            ))}
          </div>

          <div className={cols} style={{ height }}>
            {/* The hour axis, in India time. */}
            <div className="relative" aria-hidden="true">
              {hours.slice(0, -1).map((h, i) => (
                <span key={h} className={`absolute right-1.5 text-[10px] text-muted tabular-nums ${i ? "-translate-y-1/2" : ""}`} style={{ top: y(h * 60) }}>
                  {hourLabel(h)}
                </span>
              ))}
            </div>

            {days.map((d, i) => {
              const cell = week.filter((p) => dayOf(p) === d);
              const pencilled = ghosts.filter((g) => g.day === d);
              const laid = lanes([...cell.map((p) => ({ id: p.id, at: minuteOf(p), done: p.status === "posted" })), ...pencilled.map((g) => ({ id: g.id, at: g.at, done: false }))]);
              const past = d < today;
              const unknown = d < loaded;
              return (
                <div
                  key={d}
                  data-day={d}
                  role="group"
                  aria-label={`${dayName(d, { weekday: "long", day: "numeric", month: "long" })}${d === today ? ", today" : ""}: ${unknown ? "not loaded" : cell.length ? `${cell.length} ${cell.length === 1 ? "post" : "posts"}` : "nothing booked"}`}
                  className={`relative border-l border-line ${i === pick ? "" : "max-sm:hidden"} ${past ? "bg-wash" : d === today ? "bg-brand-wash" : ""} ${over === d ? "drop-here" : ""}`}
                  style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--rule) 0 1px, transparent 1px ${HOUR}px)` }}
                >
                  {/* Each account's posting windows, shaded. */}
                  {accounts.flatMap((a) =>
                    windows(a, d).map(([s, e]) => (
                      <div
                        key={`${a.handle}${s}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 border-y border-dashed border-strong/40 bg-ink/[0.05]"
                        style={{ top: y(minutes(s!)), height: y(minutes(e!)) - y(minutes(s!)) }}
                      />
                    )),
                  )}
                  {unknown && (
                    <span className="pointer-events-none absolute inset-x-0 top-0 px-1 pt-1 text-[10px] leading-tight text-muted sm:hidden" aria-hidden="true">
                      Not loaded
                    </span>
                  )}
                  {/* "open" where an account has nothing that day, from now on; accounts opening at the same time share one note. */}
                  {past
                    ? null
                    : [
                        ...accounts
                          .filter((a) => !cell.some((p) => p.handle === a.handle))
                          .reduce((m, a) => {
                            for (const [s, e] of windows(a, d)) {
                              if (d === today && minutes(e!) <= here.minutes) continue; // already closed
                              m.set(s!, [...(m.get(s!) ?? []), a.name.split(" ")[0]!]);
                            }
                            return m;
                          }, new Map<string, string[]>()),
                      ].map(([s, names]) => (
                        <span key={s} aria-hidden="true" className="pointer-events-none absolute inset-x-0 truncate px-1 pt-0.5 text-[10px] leading-tight text-muted" style={{ top: y(minutes(s)) }}>
                          {solo ? "open" : `${names.join(", ")} open`} {s}
                        </span>
                      ))}

                  {d === today && here.minutes >= from * 60 && here.minutes <= to * 60 && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-brand" style={{ top: y(here.minutes) }}>
                      <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-brand" />
                    </div>
                  )}

                  {cell.map((p, j) => {
                    const l = laid.get(p.id)!;
                    return (
                      <div
                        key={p.id}
                        className="absolute z-[var(--z)] px-0.5 hover:z-[19] focus-within:z-[19]"
                        style={
                          {
                            top: Math.min(Math.max(0, y(minuteOf(p))), height - CARD),
                            height: CARD,
                            left: l.lane * STEP,
                            width: `calc(100% - ${(l.of - 1) * STEP}px)`,
                            "--z": 10 + l.lane,
                          } as React.CSSProperties
                        }
                      >
                        <Card
                          post={p}
                          day={d}
                          who={solo ? undefined : accounts.find((a) => a.handle === p.handle)}
                          past={past}
                          tilt={(p.id % 3) - 1}
                          index={j}
                          onOver={setOver}
                          onDrop={move}
                          onOpen={() => setOpen(p)}
                        />
                      </div>
                    );
                  })}

                  {/* alienX's pencilled slot: dashed, no paper, no picture, so it never reads as a post. */}
                  {pencilled.map((g) => {
                    const l = laid.get(g.id)!;
                    return (
                      <div
                        key={g.id}
                        className="absolute z-[var(--z)] px-0.5 hover:z-[19] focus-within:z-[19]"
                        style={{ top: Math.min(Math.max(0, y(g.at)), height - CARD), height: CARD, left: l.lane * STEP, width: `calc(100% - ${(l.of - 1) * STEP}px)`, "--z": 10 + l.lane } as React.CSSProperties}
                      >
                        <button
                          type="button"
                          data-ghost=""
                          disabled={g.busy}
                          onClick={() => act(g.s)}
                          aria-label={`alienX suggests for @${g.handle} on ${dayName(d, { weekday: "long" })}: ${g.title}. ${g.s.label}.`}
                          className="grid size-full content-start gap-0.5 overflow-hidden rounded-[6px] border-[1.5px] border-dashed border-pencil bg-paper p-1.5 text-left text-pencil transition-colors hover:border-ink hover:text-ink disabled:cursor-progress motion-reduce:transition-none"
                        >
                          <span className="flex min-w-0 items-center gap-1 text-[10px] leading-tight font-semibold">
                            {!solo && <Avatar who={accounts.find((a) => a.handle === g.handle)!} size={12} />}
                            <Mascot className="size-2.5 shrink-0" />
                            <span className="truncate">alienX suggests</span>
                          </span>
                          <span className="line-clamp-2 text-[11px] leading-snug">{g.busy ? "finding ideas…" : g.title}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <PostDetail
        key={open?.id ?? "none"}
        post={open}
        account={accounts.find((a) => a.handle === open?.handle)}
        sources={open ? (sources[open.id] ?? []) : []}
        today={today}
        onClose={() => setOpen(null)}
        onKill={kill}
        onSaved={(text) => say(text)}
        onChanged={setOpen}
      />

      {toast && (
        <div role="status" className="rise fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-card bg-panel px-4 py-2.5 text-sm text-snow shadow-object">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" className="font-semibold text-snow underline underline-offset-4" onClick={toast.undo}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// A post on the grid: its picture, its time, its tags and its first line. Pressing it lifts
// it; moving it more than a few pixels drags it, glued to where it was grabbed. While in
// hand it is lifted out of the scrolling grid, so it can travel to a day chip too.
function Card({
  post,
  day,
  who,
  past,
  tilt,
  index,
  onOver,
  onDrop,
  onOpen,
}: {
  post: Post;
  day: string;
  who?: AccountInfo;
  past: boolean;
  tilt: number;
  index: number;
  onOver: (day: string | null) => void;
  onDrop: (p: Post, day: string, from: DOMRect) => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; moving: boolean; day: string | null } | null>(null);
  const dragged = useRef(false);
  const posted = post.status === "posted";
  const due = post.status === "due";
  const v = post.art && typeof post.art === "object" && "seed" in post.art ? String((post.art as { seed: number }).seed) : "";

  // Arriving in a new cell after a drop: travel from where it was let go.
  useLayoutEffect(() => {
    const from = flights.get(post.id);
    const el = ref.current;
    if (!from || !el) return;
    flights.delete(post.id);
    if (reduced()) return;
    const to = el.getBoundingClientRect();
    el.animate([{ translate: `${from.left - to.left}px ${from.top - to.top}px`, rotate: "-2deg", scale: 1.05 }, { translate: "0 0", rotate: "0deg", scale: 1 }], {
      duration: 600,
      easing: spring("--spring-bounce"),
    });
  });

  const dayUnder = (x: number, y: number) => {
    for (const n of document.elementsFromPoint(x, y)) {
      if (!(n instanceof HTMLElement)) continue;
      if ("ghost" in n.dataset) return null; // a pencilled suggestion, not a slot: nothing lands on it
      if (n.dataset.day) return n.dataset.day;
    }
    return null;
  };

  const settle = (el: HTMLElement) => {
    const s = el.style;
    s.translate = s.rotate = s.zIndex = s.cursor = s.position = s.left = s.top = s.width = s.height = "";
    if (el.parentElement) el.parentElement.style.zIndex = "";
    el.classList.remove("in-hand");
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`@${post.handle}, ${dayName(day)}, ${due ? "due now" : posted ? "posted" : clock(post.scheduled_at)}${post.picked ? ", alienX pick" : ""}: ${post.posts[0]}`}
      onPointerDown={(e) => {
        if (e.button !== 0 || posted) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, moving: false, day: null };
        dragged.current = false;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moving && Math.hypot(dx, dy) < 6) return;
        const el = e.currentTarget;
        if (!d.moving) {
          // Out of the scroller's clip: fixed, at the same spot. Its origin is the nearest
          // filtered ancestor (the sheet) or the window, so measure where 0,0 lands first.
          const box = el.getBoundingClientRect();
          Object.assign(el.style, { position: "fixed", left: "0px", top: "0px", width: `${box.width}px`, height: `${box.height}px` });
          const o = el.getBoundingClientRect();
          el.style.left = `${box.left - o.left}px`;
          el.style.top = `${box.top - o.top}px`;
          // Its slot carries the stacking order, so lift that above the day headers too.
          if (el.parentElement) el.parentElement.style.zIndex = "50";
        }
        d.moving = true;
        dragged.current = true;
        el.style.translate = `${dx}px ${dy}px`;
        el.style.rotate = "-2deg";
        el.style.zIndex = "50";
        el.style.cursor = "grabbing";
        el.classList.add("in-hand");
        d.day = dayUnder(e.clientX, e.clientY);
        onOver(d.day);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d?.moving) return;
        const el = e.currentTarget;
        const at = el.getBoundingClientRect();
        const back = el.style.translate;
        settle(el);
        onOver(null);
        navigator.vibrate?.(8); // set down
        if (d.day) onDrop(post, d.day, at);
        // Same day, or no day under it: it springs home from where it was let go.
        if ((!d.day || d.day === day) && !reduced()) el.animate([{ translate: back }, { translate: "0 0" }], { duration: 450, easing: spring() });
      }}
      onPointerCancel={(e) => {
        drag.current = null;
        dragged.current = false;
        settle(e.currentTarget);
        onOver(null);
      }}
      onClick={(e) => {
        // The click that ends a drag does not open the card; a keyboard click (detail 0) always does.
        const wasDrag = dragged.current;
        dragged.current = false;
        if (wasDrag && e.detail !== 0) return;
        onOpen();
      }}
      style={{ "--r": `${tilt * 0.5}deg`, "--i": index } as React.CSSProperties}
      className={`@container group relative block size-full touch-none cursor-grab overflow-hidden rounded-[6px] border bg-paper p-1.5 text-left text-ink shadow-[0_1px_2px_color-mix(in_srgb,black_14%,transparent)] select-none [rotate:var(--r)] hover:-translate-y-0.5 hover:[rotate:0deg] motion-reduce:[rotate:0deg] ${
        due ? "border-brand" : "border-line"
      } ${posted ? "cursor-default" : ""}`}
    >
      {/* Posted and past cards fade their contents, not their paper, so a card under one never shows through. */}
      <span className={`grid h-full ${posted ? "opacity-70" : past ? "opacity-75" : ""} grid-cols-[2.75rem_minmax(0,1fr)] grid-rows-[auto_auto_auto] content-between gap-x-1.5 @max-[8.5rem]:grid-cols-[minmax(0,1fr)] @min-[15rem]:grid-cols-[5.5rem_minmax(0,1fr)]`}>
        <span className="row-span-3 block overflow-hidden rounded-[3px] bg-wash @max-[8.5rem]:hidden">
          {post.art ? (
            <img src={`/api/art?id=${post.id}&v=${v}`} alt="" draggable={false} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-center text-[9px] leading-tight text-muted">No picture</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs leading-tight">
          {who && <Avatar who={who} size={14} />}
          {due && <span aria-hidden="true" className="size-2 shrink-0 bg-brand" />}
          <span className={`truncate font-semibold tabular-nums ${due ? "text-brand" : ""}`}>{due ? "Due now" : posted ? "Posted" : clock(post.scheduled_at)}</span>
        </span>
        <span className="truncate font-post text-[11px] leading-snug">{post.posts[0]}</span>
        {/* Tags: the pick first, so a narrow card never hides it; then what kind of post and what about. */}
        <span className="flex gap-1 overflow-hidden text-[10px] leading-tight whitespace-nowrap">
          {post.picked ? (
            <span className="flex shrink-0 items-center gap-0.5 rounded-[4px] bg-brand px-1 py-px font-semibold text-paper">
              <Mascot className="size-2.5" />
              alienX pick
            </span>
          ) : null}
          {post.angle && <span className="rounded-[4px] bg-wash px-1 py-px font-semibold">{post.angle}</span>}
          {post.pillar && <span className="truncate rounded-[4px] bg-wash px-1 py-px text-muted">{post.pillar}</span>}
          {!post.picked && !post.angle && !post.pillar && <span className="text-muted">{post.source === "plan" ? "from an idea" : "your idea"}</span>}
        </span>
      </span>
    </button>
  );
}
