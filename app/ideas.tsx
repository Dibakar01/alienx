"use client";

// Ideas, one at a time: a vertical deck of index cards that scrolls up and down (trackpad,
// mouse wheel, the arrow keys or the rail beside it), each card snapping into place. alienX's recommendation is on top. Each card carries its own
// Draft and Skip; Skip flicks the card away and can be undone for a few seconds. The last card
// discovers new ideas and shows how far along that is; new ideas drop onto the deck when they
// land. Your own words sit in one slim line above the deck and open into the composer.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { Topic } from "../lib/db.ts";
import { fit, liked, type Taste } from "../lib/taste.ts";
import type { AccountInfo } from "./accounts.tsx";
import { skipTopicAction, unskipTopicAction } from "./actions.ts";
import { Bar, startJob, useActivity, type Where } from "./activity.tsx";
import { ideaReason } from "./create-pick.ts";
import { Mascot } from "./mascot.tsx";
import { Vignette } from "./vignettes.tsx";

const UNDO_MS = 5000;

export function Ideas({
  accounts,
  topics,
  onDraft,
  busy,
  fillOf = {},
  tastes = {},
  active,
  tried,
  quiet,
  composer,
  onTeach,
  onHere,
  beside = false,
}: {
  accounts: AccountInfo[];
  topics: Topic[];
  onDraft: (t: Topic) => void;
  // Accounts drafting right now: their ideas wait until the drafts land.
  busy: Record<string, boolean>;
  // The weekday each idea would fill, when alienX would use it for an open day this week.
  fillOf?: Record<number, string>;
  // What each account drafts and skips: the deck puts the ideas that fit it first.
  tastes?: Record<string, Taste>;
  // The idea whose drafts are open, and the ideas already finished with on this page.
  active?: number;
  tried: number[];
  // Something else holds the red: Approve on open drafts, or Write on typed words.
  quiet: boolean;
  composer: React.ReactNode;
  onTeach: () => void;
  // Told whether the discover card, with its progress, is the card in front.
  onHere?: (w: Where[]) => void;
  // Drafts are open beside the ideas, with their own way back: the composer's link stays out.
  beside?: boolean;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  const ready = accounts.filter((a) => a.ready);
  const multi = accounts.length > 1;
  const handles = accounts.map((a) => a.handle);
  // Discovery running for these accounts, from here or from alienX managing on its own.
  const finding = useActivity().jobs.filter((j) => j.kind === "discover" && j.where === "idea" && j.handle && handles.includes(j.handle));
  const [writing, setWriting] = useState(false);

  // Skipped on this page: hidden and sent to the server at once, and undoable for UNDO_MS.
  const [gone, setGone] = useState<number[]>([]);
  const [flicking, setFlicking] = useState<number | null>(null);
  const [undo, setUndo] = useState<Topic | null>(null);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const refocus = useRef(false);

  // The deck is ordered by fit: what this person tends to draft rises, what they skip sinks,
  // newest first among equals. alienX's recommendation leads: the best-fitting idea that fills
  // an open day this week, else the best-fitting one not tried yet.
  const score = (t: Topic) => fit(t, tastes[t.handle]);
  const live = topics.filter((t) => !gone.includes(t.id)).sort((a, b) => score(b) - score(a));
  const pick = live.find((t) => fillOf[t.id] && !tried.includes(t.id)) ?? live.find((t) => !tried.includes(t.id)) ?? live[0];
  const deck = pick ? [pick, ...live.filter((t) => t !== pick)] : [];
  // Why it leads, when the person's own choices are part of it.
  const because = (t: Topic) => {
    const { likes } = liked(tastes[t.handle]);
    const hit = likes.filter((l) => l === `${t.angle} ideas` || l === t.pillar);
    return score(t) > 0 && hit.length ? ` You often draft ${hit.join(" and ")}.` : "";
  };

  // Ideas that arrive while the page is open drop onto the deck, and it moves to the first.
  const track = useRef<HTMLDivElement>(null);
  const known = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<number[]>([]);
  useEffect(() => {
    if (!known.current) {
      known.current = new Set(topics.map((t) => t.id));
      return;
    }
    const added = topics.filter((t) => !known.current!.has(t.id)).map((t) => t.id);
    topics.forEach((t) => known.current!.add(t.id));
    if (!added.length) return;
    setFresh(added);
    requestAnimationFrame(() => track.current?.querySelector(`[data-id="${added[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [topics]);

  // Which card is in front, for the notches. Opening or closing the composer remounts the
  // deck at its top, so both reset it.
  const [at, setAt] = useState(0);
  const cards = deck.length + (ready.length ? 1 : 0);
  // The card nearest the middle of the deck is the one in front.
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight / 2;
    let best = 0;
    [...el.children].forEach((c, i) => {
      const box = c as HTMLElement;
      const best0 = el.children[best] as HTMLElement;
      if (Math.abs(box.offsetTop + box.offsetHeight / 2 - mid) < Math.abs(best0.offsetTop + best0.offsetHeight / 2 - mid)) best = i;
    });
    // Scrolled to the bottom: the last card is in front, even if it cannot reach the middle.
    if (el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) best = cards - 1;
    setAt(best);
  };
  const go = (i: number) => {
    const el = track.current?.children[Math.max(0, Math.min(cards - 1, i))] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    return el;
  };

  // The discover card shows its own progress when it is the card in front and the deck shows.
  const front = ready.length > 0 && !(writing && deck.length) && at === cards - 1;
  useEffect(() => {
    onHere?.(front ? ["idea"] : []);
    // Only a change in what is in front matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front]);

  const discover = async (handle: string) => {
    const done = startJob({ handle, label: `Finding fresh ideas for @${handle}`, kind: "discover", where: "idea", typical: 240 });
    setErrors((e) => ({ ...e, [handle]: "" }));
    const r = (await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ research: handle }) })
      .then((x) => x.json())
      .catch((e: unknown) => ({ error: String(e) }))) as { error?: string; topics?: unknown[] };
    done(r.error ? { ok: false, text: `No fresh ideas for @${handle} this time.` } : { ok: true, text: `${r.topics?.length ?? "New"} fresh ideas for @${handle}.` });
    if (r.error) setErrors((e) => ({ ...e, [handle]: r.error! }));
    router.refresh();
  };

  // Skip: the card flicks away, the next settles in, and Undo stays for a few seconds.
  const skip = (t: Topic) => {
    // Already on its way out: a second press would send it twice.
    if (timers.current.has(t.id)) return;
    // Sent now, so a reload or a closed tab cannot lose it; Undo takes it back.
    start(async () => void (await skipTopicAction(t.id)));
    setFlicking(t.id);
    setTimeout(() => {
      setFlicking(null);
      setGone((g) => [...g, t.id]);
      setUndo(t);
      refocus.current = true;
    }, 320);
    timers.current.set(
      t.id,
      setTimeout(() => {
        timers.current.delete(t.id);
        setUndo((u) => (u?.id === t.id ? null : u));
      }, UNDO_MS),
    );
  };
  // The skipped card took focus with it: put it back on the deck so the arrows keep working.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    if (!document.activeElement || document.activeElement === document.body) track.current?.focus({ preventScroll: true });
  }, [gone]);
  const unskip = (t: Topic) => {
    clearTimeout(timers.current.get(t.id));
    timers.current.delete(t.id);
    setGone((g) => g.filter((id) => id !== t.id));
    setUndo(null);
    start(async () => void (await unskipTopicAction(t.id)));
  };

  const state = (t: Topic) => (busy[t.handle] && active === t.id ? "drafting" : active === t.id ? "drafts open" : tried.includes(t.id) ? "drafted" : "");

  if (!ready.length && !multi)
    return (
      <div className="grid justify-items-start gap-3 rounded-card border border-dashed border-strong p-5">
        <p className="text-lg font-semibold">No voice yet.</p>
        <button type="button" className={`btn ${quiet ? "btn-dark" : "btn-primary"}`} onClick={onTeach}>
          Teach it with past posts
        </button>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-1">
      {/* Your own words: one slim line until you want it. */}
      {writing || !deck.length ? (
        <div className="page-in grid gap-2">
          {deck.length > 0 && !beside && (
            <button type="button" className="link justify-self-start text-sm text-muted" onClick={() => (setWriting(false), setAt(0))}>
              ← Back to ideas
            </button>
          )}
          {composer}
        </div>
      ) : (
        <button
          type="button"
          data-press
          onClick={() => (setWriting(true), setAt(0))}
          className="flex items-center gap-2.5 rounded-card border border-line bg-wash px-3.5 py-2.5 text-left text-muted hover:border-strong hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19l1-4L16.5 4.5a2 2 0 0 1 3 3L9 18zM14 7l3 3" />
          </svg>
          Or write your own…
        </button>
      )}

      {!(writing && deck.length) && (
        <>
          <div className="flex min-h-0 flex-1 gap-2">
          <div
            ref={track}
            role="region"
            aria-roledescription="deck"
            aria-label="Ideas, one at a time. Up and down arrows move through them."
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              const el = go(e.key === "ArrowDown" ? at + 1 : at - 1);
              // From inside a card, focus follows to the card coming in, so Enter and Tab act on it.
              if (e.target !== e.currentTarget) (el?.querySelector("button") ?? track.current)?.focus({ preventScroll: true });
            }}
            className="deck flex min-h-0 flex-1 snap-y snap-mandatory flex-col items-center gap-5 overflow-x-hidden overflow-y-auto px-2 outline-none before:h-[calc(21%-1.25rem)] before:shrink-0 after:h-[calc(21%-1.25rem)] after:shrink-0 [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {deck.map((t, i) => {
              const top = t === pick;
              const fade = fresh.indexOf(t.id);
              return (
                <article
                  key={t.id}
                  data-id={t.id}
                  aria-labelledby={`idea-${t.id}`}
                  style={{ "--r": `${i === at ? 0 : (i % 2 ? 1 : -1) * 1.6}deg`, "--i": Math.max(0, fade) } as React.CSSProperties}
                  className={`card-slot sheet ${top ? "tape" : ""} grid min-h-[58%] w-full max-w-2xl shrink-0 snap-center content-center gap-3 px-6 pt-6 pb-5 max-sm:px-4 ${flicking === t.id ? "flick" : ""} ${fade >= 0 ? "drop-in" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    {top ? (
                      <span className="stamp gap-1.5">
                        <Mascot className="size-4 text-pencil" />
                        alienX recommends
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-muted tabular-nums">
                        {i + 1} / {deck.length}
                      </span>
                    )}
                    <Meta t={t} multi={multi} state={state(t)} />
                  </div>
                  <h3 id={`idea-${t.id}`} className="text-xl leading-tight font-bold tracking-[-0.02em] text-balance sm:text-2xl">
                    {t.title}
                  </h3>
                  <Takeaway t={t} className="line-clamp-4 text-[15px] leading-snug" />
                  {top && <p className="text-xs text-muted">{ideaReason(t, t === topics[0], fillOf[t.id])}{because(t)}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <button
                      id={top ? "alienx-pick" : undefined}
                      type="button"
                      className={`btn px-5 py-3 text-base ${top && !quiet ? "btn-primary" : "btn-dark"}`}
                      disabled={Boolean(busy[t.handle])}
                      onClick={() => onDraft(t)}
                    >
                      {busy[t.handle] && active === t.id ? "Drafting…" : active === t.id || tried.includes(t.id) ? "Draft again" : "Draft it"}
                    </button>
                    <button type="button" className="btn px-4 py-3 text-base" disabled={flicking === t.id || (busy[t.handle] && active === t.id)} onClick={() => skip(t)} aria-label={`Skip: ${t.title}`}>
                      Skip
                    </button>
                  </div>
                </article>
              );
            })}

            {/* The last card: more ideas, with the search's progress on the card itself. */}
            {ready.length > 0 && (
              <article aria-label="Discover new ideas" style={{ "--r": "1deg" } as React.CSSProperties} className="sheet sheet-b grid min-h-[58%] w-full max-w-2xl shrink-0 snap-center content-center justify-items-center gap-3 px-5 py-6 text-center">
                <div className="aspect-[5/3] w-40 overflow-hidden rounded-[8px] bg-wash">
                  <Vignette kind="discover" />
                </div>
                <p className="text-xl font-bold tracking-[-0.02em]">{deck.length ? "That's the deck." : "No ideas waiting."}</p>
                {finding.length > 0 ? (
                  <div className="grid w-full max-w-xs gap-2 text-left">
                    {finding.map((j) => (
                      <div key={j.id} className="grid gap-1.5">
                        <span className="truncate text-sm font-semibold">Finding ideas{multi ? ` for @${j.handle}` : ""}</span>
                        <Bar since={j.since} typical={j.typical} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2">
                    {ready.map((a) => (
                      <button key={a.handle} type="button" className={`btn px-4 py-2.5 ${deck.length || quiet ? "" : "btn-primary"}`} onClick={() => discover(a.handle)}>
                        {errors[a.handle] ? "Try again" : "Discover new ideas"}
                        {multi && <span className="font-mono text-xs opacity-75">@{a.handle}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {ready
                  .filter((a) => errors[a.handle] && !finding.some((j) => j.handle === a.handle))
                  .map((a) => (
                    <p key={a.handle} role="alert" className="text-sm font-semibold">
                      Couldn&apos;t reach the web{multi ? ` for @${a.handle}` : ""}. Try again.
                    </p>
                  ))}
              </article>
            )}
          </div>

          {/* The rail: up, where you are, down. */}
          {cards > 1 && (
            <div className="flex flex-col items-center justify-center gap-2">
              <button type="button" className="btn size-9 rounded-full p-0" aria-label="Previous idea" disabled={at === 0} onClick={() => go(at - 1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
              </button>
              {cards > 9 ? (
                <span className="text-center text-xs leading-tight font-semibold text-muted tabular-nums" aria-live="polite">
                  {at + 1}
                  <br />
                  <span className="opacity-60">{cards}</span>
                </span>
              ) : (
                <span className="flex flex-col items-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: cards }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      tabIndex={-1}
                      onClick={() => go(i)}
                      className={`w-1.5 rounded-full transition-[height,background-color] duration-300 [transition-timing-function:var(--spring)] ${i === at ? "h-6 bg-brand" : "h-1.5 bg-strong"}`}
                    />
                  ))}
                </span>
              )}
              <button type="button" className="btn size-9 rounded-full p-0" aria-label="Next idea" disabled={at >= cards - 1} onClick={() => go(at + 1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
          )}
          </div>
        </>
      )}

      {/* On the body: the sheet's filter and tilt would pin a fixed toast to the sheet. Undo is
          only ever set by a press, so this never renders on the server. */}
      {undo &&
        createPortal(
          <div role="status" className="page-in fixed bottom-[5.6rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-panel px-4 py-2 text-sm text-snow shadow-object">
            Skipped
            <button type="button" className="font-semibold underline underline-offset-4" onClick={() => unskip(undo)}>
              Undo
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

// One line of facts about an idea: whose, which angle, which pillar, how many sources.
function Meta({ t, multi, state }: { t: Topic; multi: boolean; state: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {multi && <span className="font-semibold text-ink">@{t.handle}</span>}
      <span className="rounded-[6px] bg-wash px-1.5 py-0.5 font-semibold text-ink">{t.angle}</span>
      {t.pillar && <span>{t.pillar}</span>}
      {t.findings.length > 0 && <span>{t.findings.length === 1 ? "1 source" : `${t.findings.length} sources`}</span>}
      {state && <span className="tag">{state}</span>}
    </span>
  );
}

// What the reader gets from the idea; the longer why-now shows on hover.
function Takeaway({ t, className }: { t: Topic; className: string }) {
  const [why, takeaway] = t.why.split("\nTakeaway: ");
  return (
    <span className={className} title={why}>
      {takeaway ?? why}
    </span>
  );
}
