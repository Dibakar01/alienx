"use client";

// The Studio: a week of scheduled posts on one torn sheet, one row per account, one column
// per day in India time. A card can be dragged to another day (it keeps its time there) and
// settles on One Flow's spring; a tap opens it. On a phone one day shows at a time, and a
// card dropped on a day chip moves to that day.
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Finding, Post } from "../lib/db.ts";
import { addDays, at, clock, dayName, local, ZONE } from "../lib/time.ts";
import type { AccountInfo } from "./accounts.tsx";
import { changePostAction } from "./actions.ts";
import { Mascot } from "./mascot.tsx";
import { PostDetail } from "./post-detail.tsx";
import { ViewTitle } from "./title.tsx";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const spring = (token = "--spring") => (typeof window === "undefined" ? "ease-out" : getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "ease-out");

// Where a card was when it was dropped, so it can travel from there into its new cell.
const flights = new Map<number, DOMRect>();

export function Week({ accounts, posts, sources, now }: { accounts: AccountInfo[]; posts: Post[]; sources: Record<number, Finding[]>; now: string }) {
  const today = local(new Date(now), ZONE).day;
  const [offset, setOffset] = useState(0);
  const [pick, setPick] = useState(0); // the day shown on a phone
  const [moved, setMoved] = useState<Record<number, string>>({}); // optimistic slots while a move saves
  const [gone, setGone] = useState<Record<number, boolean>>({}); // killed, until undone
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Post | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const first = addDays(today, offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const live = posts.filter((p) => !gone[p.id]).map((p) => (moved[p.id] ? { ...p, scheduled_at: moved[p.id]! } : p));
  // A post still due from before this week shows on today's column, so it is never lost.
  const dayOf = (p: Post) => {
    const d = local(new Date(p.scheduled_at), ZONE).day;
    return p.status === "due" && d < today ? today : d;
  };
  const inCell = (handle: string, day: string) => live.filter((p) => p.handle === handle && dayOf(p) === day);
  const due = live.filter((p) => p.status === "due").length;
  // One profile: no account column, and the cards get the room.
  const solo = accounts.length === 1;
  const coming = live.filter((p) => p.status === "scheduled").length;

  const say = (text: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setToast({ text, undo });
    timer.current = setTimeout(() => setToast(null), 10_000);
  };

  const move = (p: Post, day: string, from: DOMRect) => {
    if (day === dayOf(p)) return;
    // Keeps its time of day on the new day; the server picks the next free slot if that has passed.
    const guess = at(day, local(new Date(p.scheduled_at), ZONE).minutes, ZONE).toISOString();
    flights.set(p.id, from);
    setMoved((m) => ({ ...m, [p.id]: guess }));
    start(async () => {
      const r = await changePostAction({ do: "move", id: p.id, day });
      if (r.error || !r.post) {
        setMoved((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) !== p.id)));
        say(`Not moved. ${r.error ?? ""}`);
      } else {
        // The server's refreshed posts carry the new slot now; the guess is no longer needed.
        setMoved((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) !== p.id)));
        say(`Moved to ${dayName(local(new Date(r.post.scheduled_at), ZONE).day)}, ${clock(r.post.scheduled_at)}.`);
      }
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

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3 p-2 pb-24 sm:p-3 sm:pb-24 lg:gap-4 lg:px-8 lg:pt-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 pr-14">
        <Mascot className="size-8 text-brand" />
        <div className="min-w-0">
          <ViewTitle name="Studio" who={solo ? accounts[0]!.name : accounts.length === 3 ? "all three" : "all accounts"} />
          <p className="text-sm text-snow-muted">
            {due > 0 ? (
              <span className="font-semibold text-snow">
                <span key={`d${due}`} className="roll">{due}</span> {due === 1 ? "post needs you. " : "posts need you. "}
              </span>
            ) : null}
            <span key={`c${coming}`} className="roll">{coming}</span> {coming === 1 ? "post" : "posts"} on the schedule. Drag a card to another day, or open it.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2" role="group" aria-label="Week">
          <button type="button" className="btn btn-ground" onClick={() => setOffset(offset - 1)} disabled={offset <= -1} aria-label="Previous week">
            Earlier
          </button>
          <span className="min-w-28 text-center text-sm font-semibold tabular-nums">
            {offset === 0 ? "This week" : `${dayName(first, { day: "numeric", month: "short" })} to ${dayName(days[6]!, { day: "numeric", month: "short" })}`}
          </span>
          <button type="button" className="btn btn-ground" onClick={() => setOffset(offset + 1)} disabled={offset >= 2} aria-label="Next week">
            Later
          </button>
        </div>
      </header>

      <main className="sheet tape grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-3 sm:grid-rows-[minmax(0,1fr)] sm:p-5 lg:mx-auto lg:w-full lg:max-w-7xl">
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
              className={`pill min-w-12 shrink-0 rounded-card border px-2 py-1 text-xs font-semibold ${pick === i ? "border-ink bg-ink text-paper" : over === d ? "border-brand text-brand" : "border-line text-muted"}`}
            >
              {dayName(d, { weekday: "short" })}
              <span className="block text-sm tabular-nums">{dayName(d, { day: "numeric" })}</span>
            </button>
          ))}
        </div>

        <div
          className={`grid min-h-0 gap-x-2 max-sm:grid-cols-[minmax(0,1fr)] ${solo ? "sm:grid-cols-[repeat(7,minmax(0,1fr))] sm:gap-x-3" : "sm:grid-cols-[6.5rem_repeat(7,minmax(0,1fr))]"}`}
          style={{ gridTemplateRows: `auto repeat(${accounts.length}, minmax(0, 1fr))` }}
        >
          {!solo && <span className="max-sm:hidden" />}
          {days.map((d, i) => (
            <div key={d} className={`flex items-baseline gap-1.5 border-b border-line pb-1.5 ${i === pick ? "" : "max-sm:hidden"}`}>
              <span className={`text-xs font-semibold ${d === today ? "text-brand" : "text-muted"}`}>{dayName(d, { weekday: "short" })}</span>
              <span className={`text-sm font-bold tabular-nums ${d === today ? "text-brand" : ""}`}>{dayName(d, { day: "numeric" })}</span>
              {d === today && <span className="text-xs text-brand">today</span>}
            </div>
          ))}

          {accounts.map((a) => (
            <Row key={a.handle}>
              <div className={`flex flex-col justify-center gap-0.5 border-b border-line py-2 max-sm:flex-row max-sm:items-baseline max-sm:gap-2 max-sm:py-1 ${solo ? "hidden" : ""}`}>
                <span className="truncate text-sm font-semibold">@{a.handle}</span>
                <span className="truncate text-xs text-muted">{a.type === "brand" ? "brand" : a.name}</span>
              </div>
              {days.map((d, i) => {
                const cell = inCell(a.handle, d);
                return (
                  <div
                    key={d}
                    data-day={d}
                    className={`relative min-h-0 border-b border-line py-2 ${i === pick ? "" : "max-sm:hidden"} ${over === d ? "drop-here" : ""} ${d < today ? "opacity-60" : ""}`}
                  >
                    <div className="grid h-full content-start gap-1.5">
                      {cell.map((p, j) => (
                        <Card key={p.id} post={p} day={d} big={solo} tilt={(p.id % 3) - 1} index={j} onOver={setOver} onDrop={move} onOpen={() => setOpen(p)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </Row>
          ))}
        </div>
      </main>

      {live.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center pb-24">
          <p className="sheet sheet-b px-6 py-4 text-center text-sm">
            Nothing on the schedule yet. Write a thought, or draft a topic.
          </p>
        </div>
      )}

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

// An account's row: its label and seven cells, laid into the board's grid.
function Row({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}

// A scheduled post, small: its image, its time and its first line. Pressing it lifts it; moving
// it more than a few pixels drags it, glued to where it was grabbed.
function Card({
  post,
  day,
  big,
  tilt,
  index,
  onOver,
  onDrop,
  onOpen,
}: {
  post: Post;
  day: string;
  big: boolean;
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
    for (const n of document.elementsFromPoint(x, y)) if (n instanceof HTMLElement && n.dataset.day) return n.dataset.day;
    return null;
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`@${post.handle}, ${clock(post.scheduled_at)}, ${post.status}: ${post.posts[0]}`}
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
        d.moving = true;
        dragged.current = true;
        const el = e.currentTarget;
        el.style.translate = `${dx}px ${dy}px`;
        el.style.rotate = "-2deg";
        el.style.zIndex = "30";
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
        el.style.translate = "";
        el.style.rotate = "";
        el.style.zIndex = "";
        el.style.cursor = "";
        el.classList.remove("in-hand");
        onOver(null);
        navigator.vibrate?.(8); // set down
        if (d.day) onDrop(post, d.day, at);
        // Same day, or no day under it: it springs home from where it was let go.
        if ((!d.day || d.day === day) && !reduced()) el.animate([{ translate: back }, { translate: "0 0" }], { duration: 450, easing: spring() });
      }}
      onPointerCancel={(e) => {
        drag.current = null;
        dragged.current = false;
        const s = e.currentTarget.style;
        s.translate = s.rotate = s.zIndex = s.cursor = "";
        e.currentTarget.classList.remove("in-hand");
        onOver(null);
      }}
      onClick={(e) => {
        // The click that ends a drag does not open the card; a keyboard click (detail 0) always does.
        const wasDrag = dragged.current;
        dragged.current = false;
        if (wasDrag && e.detail !== 0) return;
        onOpen();
      }}
      style={{ "--r": `${tilt * 0.8}deg`, "--i": index } as React.CSSProperties}
      className={`group relative grid w-full touch-none cursor-grab gap-1 rounded-[6px] max-sm:grid-cols-[6.5rem_minmax(0,1fr)] max-sm:gap-x-2.5 border bg-paper p-1.5 text-left text-ink select-none [rotate:var(--r)] hover:-translate-y-0.5 hover:[rotate:0deg] motion-reduce:[rotate:0deg] ${due ? "border-brand" : "border-line"} ${posted ? "cursor-default opacity-70" : ""}`}
    >
      <span className="relative block aspect-video overflow-hidden rounded-[3px] bg-wash max-sm:row-span-2">
        {post.art ? (
          <img src={`/api/art?id=${post.id}&v=${v}`} alt="" draggable={false} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted">No image yet</span>
        )}
      </span>
      <span className={`flex items-center gap-1.5 ${big ? "text-sm" : "text-xs"}`}>
        {due && <span aria-hidden="true" className="size-2 shrink-0 bg-brand" />}
        <span className={`font-semibold tabular-nums ${due ? "text-brand" : ""}`}>{due ? "Due now" : posted ? "Posted" : clock(post.scheduled_at)}</span>
        {post.source === "plan" && <span className="ml-auto text-muted">researched</span>}
      </span>
      <span className={`font-post leading-snug ${big ? "line-clamp-5 text-sm" : "line-clamp-2 text-xs"}`}>{post.posts[0]}</span>
    </button>
  );
}
