"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { Draft, Post, Topic } from "../lib/db.ts";
import type { Taste } from "../lib/taste.ts";
import { LIMIT, problems, weighted } from "../lib/post.ts";
import { type AccountInfo, Accounts, type Upkeep } from "./accounts.tsx";
import { changePostAction, decideAction, scheduleAction } from "./actions.ts";
import { local, when, ZONE } from "../lib/time.ts";
import { suggest } from "../lib/suggest.ts";
import { fills, recommend } from "./create-pick.ts";
import { Bar, startJob, type Where } from "./activity.tsx";
import { Vignette } from "./vignettes.tsx";
import { artVersion, draw } from "./drawing.ts";
import { Ideas } from "./ideas.tsx";
import { Working } from "./working.tsx";
import { Mascot } from "./mascot.tsx";
import { ViewTitle } from "./title.tsx";
import { XPreview } from "./x-preview.tsx";

type Allow = { hashtags: boolean; emoji: boolean; banned: string[] };
type Format = "single" | "thread";
type Status = Draft["status"];
// `asked` records the inputs a set was made from, so the page knows when Generate would repeat them.
// `topicId` links drafts made from a discovered idea, so approving one keeps its sources.
// `rec` is the draft alienX recommends, with the reason built from its signals.
type DraftSet = { drafts: Draft[]; allow: Allow; asked: string; topicId?: number; rec?: { id: number; angle: string; reason: string } };
// What a set of drafts was made from: an idea (with its id) or your own words.
type Origin = { title: string; idea?: Topic };

const ANGLES: Record<string, string> = {
  story: "a small scene",
  contrarian: "against the grain",
  observation: "something noticed",
  lesson: "something learned",
  question: "a real question",
};
const STORE = "alienx.accounts";
// The thought being typed, kept per profile so a reload does not lose it.
const THOUGHT = "alienx.thought.";

// A laptop-wide screen (Tailwind's lg), where the ideas stay beside open drafts.
const WIDE = "(min-width: 64rem)";
const onWide = (f: () => void) => {
  const m = matchMedia(WIDE);
  m.addEventListener("change", f);
  return () => m.removeEventListener("change", f);
};

// Create: where a post gets made, as one surface that moves on by itself. alienX's recommendation leads,
// your own words sit under it, the other ideas follow. One press on an idea (or on Write for
// your own words) starts five drafts in the account's voice; the drafts open beside the ideas
// on a laptop and in their place on a phone, on the angle the idea asked for. Approving one
// prepares its picture, sources and slot and puts it on the Studio calendar. The page itself
// never scrolls; the lists and the draft scroll inside themselves.
// `start` asks for an idea to be drafted (from a Studio suggestion); each new `at` is a new ask.
// `posts` and `now` let alienX ground its suggestions in the calendar; without them it stays quiet.
// `onHere` hears which jobs show their progress on screen right now (the drafts, the discover card).
export function Studio({
  accounts,
  topics = [],
  tastes = {},
  start,
  posts,
  now,
  onOpenStudio,
  onAbout,
  onHere,
}: {
  accounts: AccountInfo[];
  topics?: Topic[];
  tastes?: Record<string, Taste>;
  start?: { topicId: number; at: number } | null;
  posts?: Post[];
  now?: string;
  onOpenStudio?: (postId?: number) => void;
  onAbout?: () => void;
  onHere?: (w: Where[]) => void;
}) {
  const ready = accounts.filter((a) => a.ready);
  const [chosen, setChosen] = useState<string[]>(ready.slice(0, 1).map((a) => a.handle));
  const [seed, setSeed] = useState("");
  const [format, setFormat] = useState<Format>("single");
  // The pillar picked for each account. None means any of that account's own pillars.
  const [pillarOf, setPillarOf] = useState<Record<string, string>>({});
  // X posts carry no hashtags (alienX's X rules), so the request always says so.
  const hashtags = false;
  // Drafts, errors, running generations and what each was made from are kept per account.
  const [sets, setSets] = useState<Record<string, DraftSet>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [origin, setOrigin] = useState<Record<string, Origin>>({});
  // When each account's drafting started, for the loading state's clock.
  const [busyAt, setBusyAt] = useState<Record<string, number>>({});
  // What has been decided on this page, so the picked draft and the tabs can show it.
  const [decided, setDecided] = useState<Record<number, Status>>({});
  // Ideas finished with on this page ("Make another"), so the recommendation moves on to the next one.
  const [tried, setTried] = useState<number[]>([]);
  // What is in front: the ideas alone, or the drafts (beside the ideas on a laptop, in their
  // place on a phone). Starting a draft brings the drafts forward by itself.
  const [pane, setPane] = useState<"ideas" | "drafts">("ideas");
  // Which account's drafts and which angle show. The angle is shared, so switching account
  // compares the same angle across voices.
  const [shown, setShown] = useState("");
  const [angle, setAngle] = useState("story");
  // Set when Write is pressed before the page is ready for it: the hint speaks up.
  const [nudge, setNudge] = useState(false);
  const [upkeep, setUpkeep] = useState<Upkeep>({ mode: "posts", who: accounts[0]?.handle ?? "" });
  // Bumped to move focus: to the drafts when they open, back to the pick for the next one.
  const [focus, setFocus] = useState<{ to: "drafts" | "pick"; n: number }>({ to: "drafts", n: 0 });
  const thought = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const draftsTitle = useRef<HTMLHeadingElement>(null);
  // The account whose drafts show, for drafts that land later; and the last ask already handled
  // (an ask that was already there when the page opened is not a new one).
  const viewRef = useRef("");
  const seen = useRef(start?.at);

  // Come back to the accounts used last time. Accounts can arrive after the page opens (just
  // signed up), so this waits for the first ready one.
  const anyReady = ready.length > 0;
  useEffect(() => {
    if (!anyReady) return;
    try {
      // The single account remembered by the earlier page counts too.
      const saved: unknown = JSON.parse(localStorage.getItem(STORE) ?? JSON.stringify([localStorage.getItem("alienx.account")]));
      if (Array.isArray(saved) && saved.some((h) => ready.some((a) => a.handle === h))) return setChosen(saved.filter((h) => typeof h === "string"));
    } catch {
      // No storage, no memory. The first account is fine.
    }
    setChosen((c) => (c.length ? c : [ready[0]!.handle]));
    // Only once there are accounts: a refreshed account list is not a reason to switch back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyReady]);

  // The thought typed last time on this profile comes back, unless something is already typed.
  const thoughtKey = THOUGHT + (accounts.length === 1 ? accounts[0]!.handle : "all");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(thoughtKey);
      if (saved) setSeed((s) => s || saved);
    } catch {
      // No storage: the box starts empty.
    }
  }, [thoughtKey]);

  useEffect(() => {
    if (!focus.n) return;
    if (focus.to === "drafts") draftsTitle.current?.focus();
    else document.getElementById("alienx-pick")?.focus();
  }, [focus]);

  // Chosen accounts in the order they are listed, voiceless ones left out. A single account has
  // no picker, so its voice is always the one writing.
  const picking = (accounts.length === 1 ? ready : ready.filter((a) => chosen.includes(a.handle))).map((a) => a.handle);
  const askFor = (h: string) => JSON.stringify([seed.trim(), format, pillarOf[h] ?? "", hashtags]);
  const working = Object.values(busy).some(Boolean);
  const pickingBusy = picking.some((h) => busy[h]);
  const repeat = picking.length > 0 && picking.every((h) => sets[h]?.asked === askFor(h) && !errors[h]);
  // Accounts with something to show in the drafts, in list order.
  const authors = accounts.map((a) => a.handle).filter((h) => sets[h] || busy[h] || errors[h]);
  const view = authors.includes(shown) ? shown : (authors[0] ?? "");
  const viewSet = view && !busy[view] && !errors[view] ? sets[view] : undefined;
  useEffect(() => {
    viewRef.current = view;
  });
  const statusOf = (d: Draft) => decided[d.id] ?? d.status;
  const picked = (h: string) => Boolean(sets[h]?.drafts.some((d) => statusOf(d) === "approved"));
  const solo = accounts.length === 1;
  const open = pane === "drafts" && authors.length > 0;
  // What shows its progress in place: the open drafts, and the discover card when the ideas
  // are on screen (beside the drafts on a laptop, in their place on a phone).
  const wide = useSyncExternalStore(onWide, () => matchMedia(WIDE).matches, () => false);
  const [ideasHere, setIdeasHere] = useState<Where[]>([]);
  const here = [...(open ? ["drafts" as const] : []), ...(!open || wide ? ideasHere : [])];
  useEffect(() => {
    onHere?.(here);
    // Only a change in what is on screen matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here.join()]);
  // Drafts waiting for a decision are open: red belongs to Approve, not to the ideas.
  const deciding = open && Boolean(viewSet) && !picked(view);
  // At most a few words under the box, and only when something needs saying.
  const hint = pickingBusy
    ? ""
    : solo && !ready.length
      ? "No voice yet. Teach it first."
      : !picking.length
        ? "Pick who is posting."
        : !seed.trim()
          ? nudge
            ? "Type a thought first."
            : ""
          : repeat
            ? "Same thought: new drafts."
            : "";

  const choose = (next: string[]) => {
    setChosen(next);
    setNudge(false);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Nothing to remember it in.
    }
  };

  const openUpkeep = (mode: Upkeep["mode"], who = upkeep.who) => {
    setUpkeep({ mode, who });
    dialog.current?.showModal();
  };

  // An account without a voice cannot be chosen yet: pressing it opens what fixes that.
  const toggle = (a: AccountInfo) => {
    if (!a.ready) return openUpkeep("posts", a.handle);
    choose(chosen.includes(a.handle) ? chosen.filter((h) => h !== a.handle) : [...chosen, a.handle]);
  };

  // One request per account, all at once. Each account's tab fills in as its drafts land.
  const run = (handles = picking, from?: { seed: string; idea: Topic }) => {
    const text = from?.seed ?? seed;
    const source = from?.idea;
    if (!handles.length) return setNudge(true);
    if (!text.trim()) {
      thought.current?.focus();
      return setNudge(true);
    }
    setNudge(false);
    setShown(handles[0]!);
    // The drafts open on the angle the idea asked for; your own words open on a small scene.
    setAngle(source && source.angle in ANGLES ? source.angle : "story");
    setPane("drafts");
    setFocus((f) => ({ to: "drafts", n: f.n + 1 }));
    setOrigin((o) => ({ ...o, ...Object.fromEntries(handles.map((h) => [h, source ? { title: source.title, idea: source } : { title: text.trim().split("\n")[0]! }])) }));
    setBusy((b) => ({ ...b, ...Object.fromEntries(handles.map((h) => [h, true])) }));
    setBusyAt((b) => ({ ...b, ...Object.fromEntries(handles.map((h) => [h, Date.now()])) }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(handles.map((h) => [h, ""])) }));
    for (const h of handles) {
      const account = accounts.find((a) => a.handle === h)!;
      const allow = { hashtags, emoji: account.emoji, banned: account.banned };
      const asked = from ? JSON.stringify([text.trim(), format, source?.pillar ?? "", hashtags]) : askFor(h);
      const fromIdea = source && source.handle === h ? source : null;
      const body = {
        handle: h,
        seed: text,
        format,
        pillar: (from ? fromIdea?.pillar : pillarOf[h]) || undefined,
        hashtags,
        research: fromIdea?.findings ?? [],
      };
      const done = startJob({ handle: h, label: `Drafting five posts for @${h}`, kind: "draft", where: "drafts", typical: 50 });
      fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => r.json() as Promise<{ drafts: Draft[] } | { error: string }>)
        .catch((e: unknown) => ({ error: String(e) }))
        .then((result) => {
          done("error" in result ? { ok: false, text: `Drafting for @${h} stopped. Try again.` } : { ok: true, text: `Five drafts ready for @${h}. Pick one to approve.` });
          if ("error" in result) setErrors((e) => ({ ...e, [h]: result.error }));
          else {
            // alienX's recommended draft opens first, if these are the drafts in front.
            const rec = recommend(result.drafts, allow, fromIdea?.angle);
            setSets((s) => ({ ...s, [h]: { drafts: result.drafts, allow, asked, topicId: fromIdea?.id, rec } }));
            if (rec && viewRef.current === h) setAngle(rec.angle);
            // Your own words became drafts: the kept copy can go, unless it was changed since.
            try {
              if (!from && localStorage.getItem(thoughtKey) === text) localStorage.removeItem(thoughtKey);
            } catch {
              // Nothing kept.
            }
          }
          setBusy((b) => ({ ...b, [h]: false }));
        });
    }
  };

  // An idea is drafted at once, for the account it belongs to, with its findings as research.
  const draftIdea = (t: Topic) => run([t.handle], { seed: `${t.title}\n\n${t.why}`, idea: t });

  // An idea asked for from elsewhere is drafted as if it were tapped here; one already drafting
  // just comes forward, and one no longer waiting is let go.
  useEffect(() => {
    if (!start || start.at === seen.current) return;
    seen.current = start.at;
    const t = topics.find((x) => x.id === start.topicId);
    if (!t) return;
    if (busy[t.handle]) {
      setShown(t.handle);
      setPane("drafts");
    } else draftIdea(t);
    // Only a new ask matters; the rest is read fresh when it comes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  // The open days alienX would fill with a waiting idea, from the calendar and the cadence.
  const hints = posts ? suggest(accounts, posts, topics, now ? new Date(now) : new Date()) : [];
  const fillOf = fills(hints);

  // Back to the ideas, with the next pick in focus.
  const another = () => {
    const done = origin[view]?.idea?.id;
    if (done) setTried((t) => (t.includes(done) ? t : [...t, done]));
    setPane("ideas");
    setFocus((f) => ({ to: "pick", n: f.n + 1 }));
  };

  // Try again repeats what the drafts were made from: the idea, or your own words.
  const retry = (h: string) => {
    const t = origin[h]?.idea;
    if (t) draftIdea(t);
    else run([h]);
  };

  const label = pickingBusy ? "Drafting…" : repeat ? "Write again" : picking.length > 1 ? `Write ${picking.length * 5} drafts` : "Write five drafts";
  // Red follows what you are working on: Approve while drafts wait, Write once your own words
  // are typed, otherwise the recommended idea. Never two at once.
  const own = Boolean(seed.trim()) && picking.length > 0 && !deciding && !repeat;

  // Your own words, in the same surface as the ideas: one box, its options, one button.
  const composer = (
    <form
      aria-labelledby="own-words"
      className="grid gap-3 rounded-card border border-line bg-wash p-3.5 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run();
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label id="own-words" htmlFor="thought" className="text-[15px] font-semibold">
          {topics.length ? "Or write your own" : "Write your own"}
        </label>
        {solo ? (
          <button type="button" className="link text-xs text-muted" onClick={() => openUpkeep("posts", accounts[0]!.handle)}>
            Teach the voice
          </button>
        ) : (
          <button type="button" className="link text-xs text-muted" onClick={() => openUpkeep("posts", picking[0] ?? upkeep.who)}>
            Accounts
          </button>
        )}
      </div>
      {!solo && (
        <div role="group" aria-label="Who is posting" className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const on = picking.includes(a.handle);
            // A chosen account carries its own pillar picker, joined to its switch.
            const picker = on && a.pillars.length > 0;
            return (
              <span key={a.handle} className="inline-flex">
                <button
                  type="button"
                  aria-pressed={a.ready ? on : undefined}
                  title={a.ready ? (a.type === "brand" ? `${a.name}, brand` : a.name) : "No voice yet. Add past posts."}
                  onClick={() => toggle(a)}
                  className={`pill inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-card border px-2.5 font-mono text-sm ${picker ? "rounded-r-none" : ""} ${on ? "border-ink bg-ink text-paper hover:bg-ink-soft" : a.ready ? "border-strong bg-paper hover:border-ink active:bg-wash" : "border-dashed border-strong bg-paper text-muted hover:border-ink"}`}
                >
                  @{a.handle}
                  {!a.ready && <span className="font-sans text-xs">no voice yet</span>}
                </button>
                {picker && (
                  <select
                    aria-label={`Pillar for @${a.handle}`}
                    value={pillarOf[a.handle] ?? ""}
                    onChange={(e) => setPillarOf((p) => ({ ...p, [a.handle]: e.target.value }))}
                    className="field tight pill min-h-9 w-auto rounded-l-none border-l-0 border-ink text-xs font-medium"
                  >
                    <option value="">Any</option>
                    {a.pillars.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                )}
              </span>
            );
          })}
        </div>
      )}
      <textarea
        ref={thought}
        id="thought"
        rows={2}
        value={seed}
        onChange={(e) => {
          setSeed(e.target.value);
          setNudge(false);
          try {
            if (e.target.value.trim()) localStorage.setItem(thoughtKey, e.target.value);
            else localStorage.removeItem(thoughtKey);
          } catch {
            // Nothing to keep it in.
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            run();
          }
        }}
        placeholder="A thought, a link, something you noticed…"
        maxLength={4000}
        className="field min-h-[4.5rem] resize-none"
      />
      {/* One profile: what it is about, as chips. Any lets the drafts pick the pillar that fits. */}
      {solo && accounts[0]!.pillars.length > 0 && (
        <span className="flex flex-wrap gap-1.5" role="group" aria-label="About">
          {["", ...accounts[0]!.pillars].map((p) => {
            const on = (pillarOf[accounts[0]!.handle] ?? "") === p;
            return (
              <button
                key={p || "any"}
                type="button"
                aria-pressed={on}
                onClick={() => setPillarOf((x) => ({ ...x, [accounts[0]!.handle]: p }))}
                className={`pill min-h-8 rounded-[6px] border px-2.5 text-sm ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-muted hover:border-strong hover:text-ink"}`}
              >
                {p || "Any topic"}
              </button>
            );
          })}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="segmented" style={{ "--at": format === "single" ? 0 : 1 } as React.CSSProperties} role="group" aria-label="Format">
          <span aria-hidden="true" />
          <button type="button" aria-pressed={format === "single"} onClick={() => setFormat("single")}>
            Single
          </button>
          <button type="button" aria-pressed={format === "thread"} onClick={() => setFormat("thread")}>
            Thread
          </button>
        </span>
        <button type="submit" className={`btn ml-auto px-5 ${own ? "btn-primary" : ""}`} disabled={pickingBusy}>
          {label}
        </button>
      </div>
      {hint && (
        <p className={`text-xs ${nudge ? "font-semibold text-ink" : "text-muted"}`} aria-live="polite">
          {hint}
        </p>
      )}
    </form>
  );

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-y-2 p-2 pb-24 sm:p-3 sm:pb-24 lg:gap-y-4 lg:px-8 lg:pt-5">
      <header className="flex min-w-0 items-center gap-3 pr-14 sm:gap-4">
        {/* The padding makes a 44px target; the negative margin keeps the header where it was. */}
        <button type="button" onClick={onAbout} aria-label="About alienX" className="-m-1.5 shrink-0 rounded-full p-1.5">
          <Mascot blink={working} className="size-8 text-brand" />
        </button>
        <div className="min-w-0">
          <ViewTitle name="Create" who={accounts.length === 1 ? accounts[0]!.name : accounts.length === 3 ? "all three" : "all accounts"} />
          <p className="truncate text-sm text-snow-muted max-sm:hidden">Pick an idea. alienX writes five drafts. Approve one.</p>
        </div>
        {/* The drafts are kept while you look at the ideas; this brings them back. */}
        {pane === "ideas" && authors.length > 0 && (
          <button type="button" className="btn btn-ground ml-auto shrink-0 gap-2" onClick={() => setPane("drafts")}>
            {working && <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />}
            {working ? "Drafting" : "Drafts"}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </header>

      <main
        className={`sheet tape grid min-h-0 w-full max-w-6xl grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] justify-self-center gap-7 p-3 sm:p-4 lg:h-full lg:max-h-[46rem] lg:self-center lg:p-6 ${open ? "lg:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)]" : ""}`}
      >
        <section aria-label="Ideas" className={`flex min-h-0 flex-col ${open ? "max-lg:hidden" : ""}`}>
          <Ideas
            accounts={accounts}
            topics={topics}
            onDraft={draftIdea}
            busy={busy}
            fillOf={fillOf}
            tastes={tastes}
            active={origin[view]?.idea?.id}
            tried={tried}
            quiet={deciding || own}
            composer={composer}
            onTeach={() => openUpkeep("posts", accounts[0]!.handle)}
            onHere={setIdeasHere}
            beside={open}
          />
        </section>

        {open && (
          // The bottom padding keeps Approve and what follows it clear of the activity card, which
          // floats just above the dock while a job (such as the picture after approving) runs.
          <section aria-labelledby="drafts-title" className="page-in flex min-h-0 flex-col gap-3 pb-[4.5rem] lg:border-l lg:border-line lg:pl-7">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" className="link shrink-0 text-muted" onClick={() => setPane("ideas")}>
                ← Back to ideas
              </button>
              <h3 id="drafts-title" ref={draftsTitle} tabIndex={-1} className="min-w-0 flex-1 basis-full truncate text-lg leading-tight font-semibold outline-none sm:basis-0">
                <span className="text-muted">Drafts from </span>
                {origin[view]?.title ?? "your words"}
              </h3>
            </div>

            {authors.length > 1 && (
              <fieldset className="flex min-w-0 flex-wrap gap-1.5">
                <legend className="sr-only">Whose drafts</legend>
                {authors.map((h) => (
                  <label
                    key={h}
                    className={`pill inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-card border px-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${h === view ? "border-ink bg-ink text-paper" : "border-strong hover:border-ink active:bg-wash"}`}
                  >
                    <input type="radio" name="author" value={h} checked={h === view} onChange={() => setShown(h)} className="sr-only" />
                    <span className="font-mono text-sm">@{h}</span>
                    {/* Only a state worth noticing is named; five drafts waiting is the normal case. */}
                    {errors[h] && !busy[h] ? <span className="tag">failed</span> : (busy[h] || picked(h)) && <span className="text-xs opacity-75">{busy[h] ? "drafting" : "picked"}</span>}
                  </label>
                ))}
              </fieldset>
            )}

            {viewSet && (
              <fieldset className="deal-row flex min-w-0 flex-wrap border-b border-line max-sm:justify-between">
                <legend className="sr-only">Angle</legend>
                {Object.keys(ANGLES).map((name, i) => {
                  const d = viewSet.drafts.find((x) => x.angle === name);
                  const s = d && statusOf(d);
                  return (
                    <label key={name} title={ANGLES[name]} style={{ "--i": i } as React.CSSProperties} className={`tab max-sm:px-0 max-sm:tracking-[0.03em] ${s === "rejected" ? "line-through" : ""}`}>
                      <input type="radio" name="angle" value={name} checked={angle === name} onChange={() => setAngle(name)} className="sr-only" />
                      {name}
                      {viewSet.rec?.angle === name && (
                        <>
                          <Mascot className="size-3.5 text-pencil" />
                          <span className="sr-only">, alienX recommends</span>
                        </>
                      )}
                      {s === "approved" && <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />}
                      {s && s !== "draft" && <span className="sr-only">, {s}</span>}
                    </label>
                  );
                })}
              </fieldset>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
              {busy[view] ? (
                <div className="grid flex-1 place-items-center rounded-card bg-wash">
                  <Working
                    kind="draft"
                    title={`Writing five drafts for @${view}`}
                    since={busyAt[view]}
                    typical={35}
                  />
                </div>
              ) : errors[view] ? (
                <Notice text="Signal lost. Try again." note={errors[view]} alert>
                  <button type="button" className="btn btn-primary" onClick={() => retry(view)}>
                    Try again
                  </button>
                </Notice>
              ) : null}
              {/* Every draft stays mounted so its edits and decision survive switching tabs; only one shows. */}
              {Object.entries(sets).flatMap(([h, set]) =>
                set.drafts.map((d) => (
                  <Card
                    key={d.id}
                    hidden={set !== viewSet || d.angle !== angle}
                    draft={d}
                    allow={set.allow}
                    picked={picked(h)}
                    account={accounts.find((a) => a.handle === h)}
                    topicId={set.topicId}
                    recommend={set.rec?.id === d.id ? set.rec.reason : undefined}
                    onOpenStudio={onOpenStudio}
                    onAnother={another}
                    onDecided={(status) => setDecided((all) => ({ ...all, [d.id]: status }))}
                  />
                )),
              )}
            </div>
          </section>
        )}
      </main>

      <Accounts
        ref={dialog}
        accounts={accounts}
        upkeep={upkeep}
        onChange={setUpkeep}
        onAdded={(h) => {
          choose([...new Set([...chosen, h])]);
          dialog.current?.close();
        }}
      />
    </div>
  );
}

// A failed state fills the drafts area.
function Notice({ text, note, alert = false, children }: { text: string; note?: string; alert?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center" role={alert ? "alert" : undefined} aria-live={alert ? undefined : "polite"}>
      <Mascot className="size-14 text-muted" />
      <p className="font-medium">{text}</p>
      {note && <p className={`max-w-sm ${alert ? "font-mono text-xs text-muted" : "text-sm text-muted"}`}>{note}</p>}
      {children}
    </div>
  );
}

function Card({
  draft,
  allow,
  picked,
  hidden,
  account,
  topicId,
  recommend,
  onOpenStudio,
  onAnother,
  onDecided,
}: {
  draft: Draft;
  allow: Allow;
  picked: boolean;
  hidden: boolean;
  account?: AccountInfo;
  topicId?: number;
  recommend?: string;
  onOpenStudio?: (postId?: number) => void;
  onAnother: () => void;
  onDecided: (status: Status) => void;
}) {
  // Edit the words, or see them as the feed will show them.
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [posts, setPosts] = useState(draft.posts);
  // A thread shows one post at a time.
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState(draft.status);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [failed, setFailed] = useState(false);
  // What went wrong on Approve, when the server says (a full calendar, say).
  const [why, setWhy] = useState("");
  const [busy, start] = useTransition();
  const single = posts.length === 1;
  const text = posts[page] ?? "";
  const count = weighted(text);
  const flags = problems(text, allow).filter((p) => !p.startsWith("over limit"));
  const long = posts.findIndex((p) => weighted(p) > LIMIT);
  const unverified = draft.claims.filter((c) => c.source === "unverified").length;
  // Solid red marks the draft to post: every draft until one is approved, then only that one.
  const id = `post-${draft.id}`;

  // The scheduled post this draft became, so Undo can take it off the schedule again.
  const [scheduled, setScheduled] = useState<{ id: number; at: string } | null>(null);
  // Its picture: when drawing started (0 when idle), and a version once it is drawn.
  const [drawing, setDrawing] = useState(0);
  const [art, setArt] = useState("");
  const router = useRouter();

  const decide = (next: Status) =>
    start(async () => {
      if (next === "draft" && scheduled) {
        // Undo takes the post off the schedule first; if it already went out, the draft stays scheduled.
        const off = await changePostAction({ do: "kill", id: scheduled.id, undo: true });
        if (off.error) return setFailed(true);
      }
      const result = await decideAction({ id: draft.id, status: next, posts, reason: next === "rejected" ? reason : undefined });
      setFailed(Boolean(result.error));
      if (result.error) return;
      if (next === "draft") setScheduled(null);
      setStatus(next);
      onDecided(next);
      setRejecting(false);
    });

  // Approve: the draft goes on the account's next free slot in the Studio calendar, with its
  // sources if it came from an idea; its picture is drawn in the background.
  const schedule = () =>
    start(async () => {
      const result = await scheduleAction({ id: draft.id, handle: draft.handle, topic_id: topicId, posts, claims: draft.claims });
      setFailed(Boolean(result.error));
      setWhy(result.error ?? "");
      if (result.error || !result.post) return;
      setScheduled({ id: result.post.id, at: result.post.scheduled_at });
      navigator.vibrate?.(12); // a small knock on phones, as the stamp lands
      setStatus("approved");
      onDecided("approved");
      // The picture draws right here on the card, so the activity card leaves it out while the drafts show.
      const d = draw(result.post.id, draft.handle, "drafts");
      setDrawing(d.since);
      void d.done.then((p) => {
        setDrawing(0);
        if (!p) return;
        setArt(artVersion(p));
        // The Studio and the front door get the picture now, not at the next minute's refresh.
        router.refresh();
      });
    });

  return (
    <article hidden={hidden} aria-label={`${draft.angle}: ${ANGLES[draft.angle]}`} className="draft-card flex min-h-0 flex-1 flex-col gap-3 pt-1">
      <div className="flex items-center justify-between gap-3">
        <span className="label">{single ? ANGLES[draft.angle] : `Post ${page + 1} of ${posts.length}`}</span>
        <span className="segmented" style={{ "--at": mode === "preview" ? 0 : 1 } as React.CSSProperties} role="group" aria-label="Show">
          <span aria-hidden="true" />
          <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>
            On X
          </button>
          <button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>
            Edit
          </button>
        </span>
      </div>
      {recommend && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="stamp gap-1 px-1.5 py-0.5 text-xs">
            <Mascot className="size-3.5 text-pencil" />
            alienX recommends
          </span>
          {recommend}
        </p>
      )}
      {!single && (
        <div className="flex items-center justify-end gap-3">
          <span className="flex gap-2">
            <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button type="button" className="btn" disabled={page === posts.length - 1} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </span>
        </div>
      )}
      {mode === "preview" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <XPreview name={account?.name ?? draft.handle} handle={draft.handle} brand={account?.type === "brand"} text={text} />
        </div>
      )}
      <textarea
        id={id}
        hidden={mode === "preview"}
        aria-label={single ? `${draft.angle} draft` : `Post ${page + 1} of ${posts.length}`}
        rows={2}
        value={text}
        disabled={status !== "draft"}
        onChange={(e) => setPosts(posts.map((p, j) => (j === page ? e.target.value : p)))}
        className={`field min-h-20 flex-1 resize-none font-post text-[15px] leading-[1.4] ${status === "approved" ? "disabled:border-ink disabled:bg-paper disabled:text-ink" : ""}`}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted tabular-nums">
          {count} / {LIMIT}
        </span>
        {count > LIMIT ? (
          <>
            <span className="tag">{count - LIMIT} over</span>
            <span className="text-sm text-muted">Too long to post. Trim it first.</span>
          </>
        ) : (
          long >= 0 && <span className="tag">post {long + 1} is too long</span>
        )}
        {flags.map((f) => (
          <span key={f} className="tag">
            {f}
          </span>
        ))}
        {draft.claims.length > 0 && (
          <>
            {/* The claims open over the draft, above this button, so opening them never grows the page. */}
            <button type="button" popoverTarget={`claims-${draft.id}`} className="claims-anchor ml-auto flex min-h-10 cursor-pointer items-center gap-2 rounded-[4px] text-sm text-muted hover:text-ink">
              <svg viewBox="0 0 8 8" aria-hidden="true" className="size-2 shrink-0">
                <path d="M0.5 6 4 1.5 7.5 6Z" fill="currentColor" />
              </svg>
              {unverified > 0 ? (
                <>
                  <span className="tag">unverified</span>
                  {unverified === 1 ? "1 claim to check" : `${unverified} claims to check`}
                </>
              ) : (
                `${draft.claims.length === 1 ? "1 claim" : `${draft.claims.length} claims`}, all sourced`
              )}
            </button>
            <div id={`claims-${draft.id}`} popover="auto" className="claims-pop">
              <p className="mb-3 text-sm">
                {unverified > 0
                  ? `${unverified === 1 ? "1 claim is" : `${unverified} claims are`} not in the facts, your thought or the research. Check before posting.`
                  : "Every claim traces to the facts, your thought or the research."}
              </p>
              <ul className="grid gap-2 text-sm">
                {draft.claims.map((c, i) => (
                  <li key={i} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                    <span className={c.source === "unverified" ? "tag justify-self-start" : "font-mono text-xs leading-5 text-muted"}>{c.source === "seed" ? "your idea" : c.source}</span>
                    <span className={c.source === "unverified" ? "" : "text-muted"}>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* One action on the draft: Approve. Once decided, the row turns into what happened and
          where to go next, in place. Reject with a reason stays quiet beside Approve. */}
      {status === "approved" ? (
        // Approved: the post and its picture, drawn right here, then the two ways on.
        <div className="reveal grid gap-3 rounded-card border-2 border-ink p-3 sm:p-3.5" role="status">
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[6px] bg-wash">
              {art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/art?id=${scheduled!.id}&v=${art}`} alt="" className="deal size-full object-cover" />
              ) : (
                <Vignette kind="picture" />
              )}
            </div>
            <div className="grid min-w-0 gap-1.5">
              <span className="stamp stamp-solid justify-self-start">approved</span>
              <p className="truncate font-semibold">{scheduled ? `${when(scheduled.at)} IST` : "Approved"}</p>
              {drawing ? <Bar since={drawing} typical={35} /> : !art && scheduled && <p className="text-xs text-muted">No picture yet. Draw it from the post.</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scheduled && onOpenStudio && (
              <button type="button" className="btn btn-primary px-5" onClick={() => onOpenStudio(scheduled.id)}>
                Open the post
              </button>
            )}
            <button type="button" className="btn" onClick={onAnother}>
              Make another
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {status === "rejected" ? (
            <>
              <span className="stamp">rejected</span>
              <span className="text-sm text-muted max-sm:sr-only">Saved with your reason. The next drafts avoid this.</span>
              <button type="button" className="link" disabled={busy} onClick={() => decide("draft")}>
                Undo
              </button>
            </>
          ) : rejecting ? (
            <form
              className="reveal flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                decide("rejected");
              }}
            >
              <input
                id={`reason-${draft.id}`}
                aria-label="Reason for rejecting"
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why. One line."
                maxLength={200}
                className="field min-w-0 flex-1"
              />
              <button type="submit" className="btn btn-dark" disabled={busy || !reason.trim()}>
                Reject
              </button>
              <button type="button" className="btn" onClick={() => setRejecting(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              {/* Solid red marks the draft to post: every draft until one is approved. */}
              <button type="button" className={`btn px-6 py-2.5 text-base ${picked ? "" : "btn-primary"}`} disabled={busy || long >= 0} onClick={schedule}>
                {busy ? "Approving…" : "Approve"}
              </button>
              <Copy text={text} />
              <button type="button" className="link ml-auto text-muted" disabled={busy} onClick={() => setRejecting(true)}>
                Reject with a reason
              </button>
            </>
          )}
          {failed && (
            <p className="basis-full text-sm font-medium" role="alert">
              {why && !/fetch|network/i.test(why) ? why : "Signal lost. Try again."}
            </p>
          )}
        </div>
      )}
      {status === "approved" && failed && (
        <p className="text-sm font-medium" role="alert">
          Signal lost. Try again.
        </p>
      )}
    </article>
  );
}

function Copy({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setLabel("Copied");
        } catch {
          setLabel("Not copied");
        }
        setTimeout(() => setLabel("Copy"), 1500);
      }}
    >
      {label}
    </button>
  );
}
