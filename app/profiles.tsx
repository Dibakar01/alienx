"use client";

// Who is posting: a rotary dial. "Add an account" comes first on the rim, then each account,
// then all of them. Turn it (drag, arrow keys, the scroll wheel, or tap a name); it clicks
// into each detent on One Flow's spring, and the centre shows who is chosen with Enter.
// Profiles are a view, not a permission: the one login covers everyone. With no accounts
// yet (a fresh clone), it welcomes you and adds the first one.
import { useEffect, useRef, useState } from "react";
import type { Post, Topic } from "../lib/db.ts";
import { type Suggestion, suggest } from "../lib/suggest.ts";
import { local, ZONE } from "../lib/time.ts";
import { type AccountInfo, Accounts, type Upkeep } from "./accounts.tsx";
import { Avatar } from "./avatar.tsx";
import { readDismissed } from "./dismissed.ts";
import { Mascot } from "./mascot.tsx";

type Slot = { kind: "add" } | { kind: "account"; account: AccountInfo } | { kind: "all" };

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const needsYou = (s: Suggestion) => s.kind === "due" || s.kind === "review";
const things = (n: number) => `${n} ${n === 1 ? "thing needs" : "things need"} you`;

// alienX's top suggestion for the centre card: its own sentence from lib/suggest.ts, with the
// handle taken out (the card already names the account), so it reads the same as elsewhere.
function line(top: Suggestion | undefined, tips: Suggestion[]) {
  if (!top) return "All set for this week.";
  if (top.kind === "due") {
    const n = tips.filter((t) => t.kind === "due").length;
    return `${n} ${n === 1 ? "post" : "posts"} due now.`;
  }
  const h = `@${top.handle}`;
  const text = top.text.replace(`${h}'s `, "the ").replace(`${h} has`, "Has").replace(` for ${h}`, "");
  // "alienX" keeps its small a; any other sentence starts with a capital.
  return text.startsWith("alienX") ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

export function Profiles({
  accounts,
  posts,
  topics,
  now,
  onPick,
  onAbout,
}: {
  accounts: AccountInfo[];
  posts: Post[];
  topics: Topic[];
  now: string;
  onPick: (handle: string) => void;
  onAbout?: () => void;
}) {
  // "Not today" from any screen hides a suggestion here too, except a due post: that stays.
  const today = local(new Date(now), ZONE).day;
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setHidden(readDismissed(today)), [today]);
  const tips = suggest(accounts, posts, topics, new Date(now)).filter((t) => t.kind === "due" || !hidden.includes(t.id));
  const tipsFor = (handle: string) => tips.filter((t) => t.handle === handle);
  const waiting = (handle?: string) => tips.filter((t) => needsYou(t) && (!handle || t.handle === handle)).length;
  const dialog = useRef<HTMLDialogElement>(null);
  const [upkeep, setUpkeep] = useState<Upkeep>({ mode: "add", who: accounts[0]?.handle ?? "" });
  const add = () => {
    setUpkeep((u) => ({ ...u, mode: "add" }));
    dialog.current?.showModal();
  };
  const accountsDialog = <Accounts ref={dialog} accounts={accounts} upkeep={upkeep} onChange={setUpkeep} onAdded={() => dialog.current?.close()} />;

  const slots: Slot[] = [{ kind: "add" }, ...accounts.map((account) => ({ kind: "account" as const, account })), ...(accounts.length > 1 ? [{ kind: "all" as const }] : [])];
  const n = slots.length;
  const step = 360 / n;
  // The dial's turn in degrees; the slot at the pointer is the chosen one. Starts on the first account.
  const [rot, setRot] = useState(-step);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ a0: number; r0: number; last: number } | null>(null);
  const face = useRef<HTMLDivElement>(null);
  const chosen = mod(Math.round(-rot / step), n);
  const slot = slots[chosen]!;

  // A small knock on phones each time a detent passes under the pointer.
  const lastTick = useRef(chosen);
  useEffect(() => {
    if (lastTick.current !== chosen) navigator.vibrate?.(4);
    lastTick.current = chosen;
  }, [chosen]);

  const turnTo = (i: number) => {
    // The shortest way round to slot i.
    const target = -i * step;
    const diff = mod(target - rot + 180, 360) - 180;
    setRot(rot + diff);
  };
  const enter = (s: Slot = slot) => (s.kind === "add" ? add() : onPick(s.kind === "all" ? "all" : s.account.handle));

  const angleAt = (x: number, y: number) => {
    const r = face.current!.getBoundingClientRect();
    return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  if (accounts.length === 0)
    return (
      <div className="grid h-full place-items-center p-4">
        <div className="sheet tape grid max-w-md justify-items-center gap-4 px-8 pt-10 pb-8 text-center">
          <Mascot className="size-14 text-brand" />
          <h2 className="text-2xl font-bold tracking-[-0.03em]">Welcome to alienX</h2>
          <p className="text-sm text-muted">
            Add the X accounts alienX writes for. For each one, give it the account&apos;s own public writing (a Substack or blog link) or paste past posts, and it learns the voice. It takes a minute or two.
          </p>
          <button type="button" className="btn btn-primary px-5 py-3 text-base" onClick={add}>
            Add your first account
          </button>
        </div>
        {accountsDialog}
      </div>
    );

  const stats = (handle?: string) => {
    const mine = posts.filter((p) => !handle || p.handle === handle);
    const due = mine.filter((p) => p.status === "due").length;
    const coming = mine.filter((p) => p.status === "scheduled").length;
    return due ? `${due} ${due === 1 ? "post" : "posts"} due` : `${coming} on the calendar`;
  };
  const ease = dragging || reduced() ? "none" : "transform var(--dur-spring) var(--spring)";

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-2 p-4 sm:p-8">
      <header className="flex items-center gap-4 pr-14">
        <button type="button" onClick={onAbout} aria-label="About alienX" className="rounded-full">
          <Mascot className="size-9 text-brand" />
        </button>
        <div>
          <h2 className="text-2xl leading-tight font-bold tracking-[-0.03em]">Who is posting?</h2>
          <p className="text-sm text-snow-muted">Turn the dial (drag it, use the arrow keys or tap a name), then enter.</p>
        </div>
      </header>

      <main className="grid place-items-center">
        <div
          ref={face}
          role="listbox"
          tabIndex={0}
          aria-label="Who is posting. Turn with the arrow keys, Enter to choose."
          aria-activedescendant={`slot-${chosen}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), setRot(rot - step));
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), setRot(rot + step));
            if (e.key === "Enter" || e.key === " ") (e.preventDefault(), enter());
          }}
          onWheel={(e) => setRot(rot + (e.deltaY > 0 ? -step : step))}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { a0: angleAt(e.clientX, e.clientY), r0: rot, last: rot };
            setDragging(true);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            let delta = angleAt(e.clientX, e.clientY) - d.a0;
            delta = mod(delta + 180, 360) - 180;
            d.last = d.r0 + delta;
            setRot(d.last);
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            setDragging(false);
            if (d) setRot(Math.round(d.last / step) * step);
          }}
          style={{ "--dial": "min(36rem, 94vw, 62vh)" } as React.CSSProperties}
          className="relative aspect-square w-(--dial) cursor-grab touch-none rounded-full outline-none select-none focus-visible:ring-4 focus-visible:ring-brand/60 active:cursor-grabbing"
        >
          {/* The finger stop, fixed at twelve o'clock: whoever turns under it is posting. */}
          <svg viewBox="0 0 20 18" aria-hidden="true" className="absolute -top-3.5 left-1/2 z-10 w-7 -translate-x-1/2 drop-shadow-md">
            <path d="M4 0h12a4 4 0 0 1 4 4c0 1.2-.5 2.2-1.3 3L10 17 1.3 7A4 4 0 0 1 4 0Z" fill="var(--red)" />
          </svg>

          {/* The finger wheel: a paper disc with a bezel, and a finger hole for each slot. */}
          <div className="absolute inset-0 rounded-full bg-paper shadow-object" style={{ transform: `rotate(${rot}deg)`, transition: ease }}>
            <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full">
              <circle cx="100" cy="100" r="98.6" fill="none" stroke="var(--rule-strong)" strokeWidth="1.2" />
              <circle cx="100" cy="100" r="95" fill="none" stroke="var(--rule)" strokeWidth="0.6" />
              {Array.from({ length: n * 4 }, (_, i) =>
                i % 4 ? <path key={i} d="M100 3.4V5.6" stroke="var(--rule-strong)" strokeWidth="0.7" transform={`rotate(${(i * 360) / (n * 4)} 100 100)`} /> : null,
              )}
            </svg>
            {slots.map((s, i) => {
              const on = i === chosen;
              const name = s.kind === "add" ? "Add an account" : s.kind === "all" ? "All accounts" : s.account.name;
              const need = s.kind === "account" ? waiting(s.account.handle) : 0;
              const label = need ? `${name}, ${things(need)}` : name;
              return (
                <div key={i} className="absolute top-1/2 left-1/2 size-0" style={{ transform: `rotate(${i * step}deg) translateY(calc(var(--dial) * -0.355))` }}>
                  <button
                    id={`slot-${i}`}
                    role="option"
                    aria-selected={on}
                    aria-label={label}
                    title={label}
                    type="button"
                    onClick={() => (on ? enter(s) : turnTo(i))}
                    style={{ transform: `translate(-50%, -50%) rotate(${-(i * step) - rot}deg)`, transition: ease }}
                    className={`absolute grid size-[calc(var(--dial)*0.2)] place-items-center rounded-full bg-wash shadow-[inset_0_3px_7px_rgb(0_0_0/0.28),inset_0_-1px_0_rgb(255_255_255/0.7)] transition-[box-shadow,filter] duration-200 ${
                      on ? "ring-[3px] ring-brand ring-offset-[3px] ring-offset-paper" : "*:grayscale-[0.65] *:transition-[filter] hover:*:grayscale-0"
                    }`}
                  >
                    {need > 0 && (
                      <span aria-hidden="true" className="absolute top-[6%] right-[6%] z-10 size-[max(10px,calc(var(--dial)*0.032))] rounded-full bg-brand ring-2 ring-paper grayscale-0!" />
                    )}
                    {s.kind === "add" ? (
                      <span className="grid size-[78%] place-items-center rounded-full border-2 border-dashed border-strong text-[calc(var(--dial)*0.06)] leading-none text-muted">+</span>
                    ) : s.kind === "all" ? (
                      <span className="flex -space-x-[calc(var(--dial)*0.025)]">
                        {accounts.slice(0, 3).map((a) => (
                          <Avatar key={a.handle} who={a} size={28} className="size-[calc(var(--dial)*0.075)]! ring-2 ring-wash" />
                        ))}
                      </span>
                    ) : (
                      <Avatar who={s.account} size={56} className="size-[84%]!" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* The number card in the middle stays still: who is chosen, and the way in. */}
          <div className="absolute inset-[28%] grid place-items-center rounded-full bg-paper text-center text-ink shadow-[0_0_0_1px_var(--rule-strong),var(--lift)]">
            <span aria-hidden="true" className="absolute inset-[5%] rounded-full border border-dashed border-line" />
            <div className="relative grid justify-items-center gap-1 px-5 max-sm:gap-0.5 max-sm:px-3" key={chosen}>
              <p className="roll text-[11px] max-sm:hidden! font-semibold tracking-[0.14em] text-muted uppercase">{slot.kind === "add" ? "New voice" : "Posting as"}</p>
              <p className="roll text-xl leading-tight font-bold tracking-[-0.02em] sm:text-2xl">{slot.kind === "add" ? "Add an account" : slot.kind === "all" ? "All accounts" : slot.account.name}</p>
              <p className="roll text-sm text-muted">{slot.kind === "add" ? "Teach alienX a new voice" : slot.kind === "all" ? (waiting() ? things(waiting()) : stats()) : `@${slot.account.handle}`}</p>
              {slot.kind === "account" && (
                <p className={`roll line-clamp-2 max-w-[12rem] text-xs leading-snug max-sm:text-[11px] max-sm:leading-tight ${waiting(slot.account.handle) ? "font-semibold text-brand" : "text-muted"}`}>
                  {line(tipsFor(slot.account.handle)[0], tipsFor(slot.account.handle))}
                </p>
              )}
              <button type="button" className="btn btn-primary mt-2 px-6 max-sm:mt-1" onClick={() => enter()}>
                {slot.kind === "add" ? "Add" : "Enter"}
              </button>
            </div>
          </div>
        </div>
      </main>

      <span />
      {accountsDialog}
    </div>
  );
}
