"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Draft } from "../lib/db.ts";
import { LIMIT, problems, weighted } from "../lib/post.ts";
import { type AccountInfo, Accounts, type Upkeep } from "./accounts.tsx";
import { changePostAction, decideAction, scheduleAction } from "./actions.ts";
import { when } from "../lib/time.ts";
import { Mascot } from "./mascot.tsx";
import { ViewTitle } from "./title.tsx";
import { XPreview } from "./x-preview.tsx";

type Allow = { hashtags: boolean; emoji: boolean; banned: string[] };
type Format = "single" | "thread";
type Status = Draft["status"];
// `asked` records the inputs a set was made from, so the page knows when Generate would repeat them.
type DraftSet = { drafts: Draft[]; allow: Allow; asked: string };

const ANGLES: Record<string, string> = {
  story: "a small scene",
  contrarian: "against the grain",
  observation: "something noticed",
  lesson: "something learned",
  question: "a real question",
};
const STORE = "alienx.accounts";

// One object on a quiet ground. The thought is on one face and the post on the other: side
// by side on a laptop, one at a time on a phone. The page itself never scrolls; the two
// text boxes take whatever height is left.
export function Studio({ accounts, onOpenStudio }: { accounts: AccountInfo[]; onOpenStudio?: () => void }) {
  const ready = accounts.filter((a) => a.ready);
  const [chosen, setChosen] = useState<string[]>(ready.slice(0, 1).map((a) => a.handle));
  const [seed, setSeed] = useState("");
  const [format, setFormat] = useState<Format>("single");
  // The pillar picked for each account. None means any of that account's own pillars.
  const [pillarOf, setPillarOf] = useState<Record<string, string>>({});
  // X posts carry no hashtags (alienX's X rules), so the request always says so.
  const hashtags = false;
  // Drafts, errors and running generations are kept per account.
  const [sets, setSets] = useState<Record<string, DraftSet>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // What has been decided on this page, so the picked draft and the tabs can show it.
  const [decided, setDecided] = useState<Record<number, Status>>({});
  // Which account's drafts and which angle the post face shows. The angle is shared, so
  // switching account compares the same angle across voices.
  const [shown, setShown] = useState("");
  const [angle, setAngle] = useState("story");
  // On a phone only one face shows at a time.
  const [face, setFace] = useState<"thought" | "post">("thought");
  // Set when Generate is pressed before the page is ready for it: the hint speaks up.
  const [nudge, setNudge] = useState(false);
  const [upkeep, setUpkeep] = useState<Upkeep>({ mode: "posts", who: accounts[0]?.handle ?? "" });
  const thought = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  // Come back to the accounts used last time.
  useEffect(() => {
    try {
      // The single account remembered by the earlier page counts too.
      const saved: unknown = JSON.parse(localStorage.getItem(STORE) ?? JSON.stringify([localStorage.getItem("alienx.account")]));
      if (Array.isArray(saved) && saved.some((h) => ready.some((a) => a.handle === h))) setChosen(saved.filter((h) => typeof h === "string"));
    } catch {
      // No storage, no memory. The first account is fine.
    }
    // Only on first load: a refreshed account list is not a reason to switch back.
  }, []);

  // Chosen accounts in the order they are listed, voiceless ones left out.
  const picking = ready.filter((a) => chosen.includes(a.handle)).map((a) => a.handle);
  const askFor = (h: string) => JSON.stringify([seed.trim(), format, pillarOf[h] ?? "", hashtags]);
  const working = Object.values(busy).some(Boolean);
  const repeat = picking.length > 0 && picking.every((h) => sets[h]?.asked === askFor(h) && !errors[h]);
  // Accounts with something to show on the post face, in list order.
  const authors = accounts.map((a) => a.handle).filter((h) => sets[h] || busy[h] || errors[h]);
  const view = authors.includes(shown) ? shown : (authors[0] ?? "");
  const viewSet = view && !busy[view] && !errors[view] ? sets[view] : undefined;
  const statusOf = (d: Draft) => decided[d.id] ?? d.status;
  const picked = (h: string) => Boolean(sets[h]?.drafts.some((d) => statusOf(d) === "approved"));
  // The step to do now: choose who is posting, then say the thought, then pick a draft.
  const current = !picking.length ? 1 : working || repeat ? 3 : 2;
  // Inside one profile the account is already chosen: the "who" step disappears and the
  // steps are numbered from the thought.
  const solo = accounts.length === 1;
  const step = (n: number) => (solo ? n - 1 : n);
  const hint = working
    ? "About half a minute."
    : !picking.length
      ? "Choose who is posting first."
      : !seed.trim()
        ? "Type a thought first."
        : repeat
          ? `Same thought. This makes ${picking.length * 5} new drafts.`
          : "Cmd or Ctrl + Enter works too.";

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
  const run = (handles = picking) => {
    if (!handles.length) return setNudge(true);
    if (!seed.trim()) {
      thought.current?.focus();
      return setNudge(true);
    }
    setNudge(false);
    setShown(handles[0]!);
    setFace("post");
    setBusy((b) => ({ ...b, ...Object.fromEntries(handles.map((h) => [h, true])) }));
    setErrors((e) => ({ ...e, ...Object.fromEntries(handles.map((h) => [h, ""])) }));
    for (const h of handles) {
      const account = accounts.find((a) => a.handle === h)!;
      const allow = { hashtags, emoji: account.emoji, banned: account.banned };
      const asked = askFor(h);
      const body = { handle: h, seed, format, pillar: pillarOf[h] || undefined, hashtags };
      fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => r.json() as Promise<{ drafts: Draft[] } | { error: string }>)
        .catch((e: unknown) => ({ error: String(e) }))
        .then((result) => {
          if ("error" in result) setErrors((e) => ({ ...e, [h]: result.error }));
          else setSets((s) => ({ ...s, [h]: { drafts: result.drafts, allow, asked } }));
          setBusy((b) => ({ ...b, [h]: false }));
        });
    }
  };

  const label = working ? "Working on it." : repeat ? "Generate again" : picking.length ? `Generate ${picking.length * 5} drafts` : "Generate drafts";

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] p-2 pb-24 sm:p-3 sm:pb-24 lg:gap-y-4 lg:px-8 lg:pt-5">
      <header className="row-start-1 flex items-center gap-4 pr-14 max-lg:pb-2">
        <Mascot blink={working} className="size-8 text-brand" />
        <div>
          <ViewTitle name="Write" who={accounts.length === 1 ? accounts[0]!.name : accounts.length === 3 ? "all three" : "all accounts"} />
          <p className="text-sm text-snow-muted max-sm:hidden">A thought becomes five drafts. Schedule the one worth posting.</p>
        </div>
      </header>

      <main className="sheet tape row-start-2 grid min-h-0 w-full max-w-6xl grid-rows-[auto_1fr] justify-self-center lg:h-full lg:max-h-[46rem] lg:grid-cols-2 lg:grid-rows-1 lg:self-center">
        {/* Phone only: the mark and the switch between the two faces. */}
        <div className="flex items-center gap-3 border-b border-line px-3 py-2 lg:hidden">
          <div role="group" aria-label="Face" className="mx-auto flex gap-1">
            {(["thought", "post"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={face === f}
                onClick={() => setFace(f)}
                className={`pill cursor-pointer rounded-card px-3.5 py-1.5 text-sm font-medium ${face === f ? "bg-ink text-paper" : "text-ink hover:bg-wash"}`}
              >
                {f === "thought" ? "Thought" : "Post"}
              </button>
            ))}
          </div>
        </div>

        <section aria-label="The thought" className={`flex min-h-0 flex-col gap-3 p-4 lg:p-6 ${face === "post" ? "max-lg:hidden" : ""}`}>
          {!solo && (
          <Head n={1} shown={step(1)} current={current} title="Who is posting">
            <button type="button" className="link" onClick={() => openUpkeep("posts", picking[0] ?? upkeep.who)}>
              Accounts
            </button>
          </Head>
          )}
          <div role="group" aria-labelledby="step-1" className={`flex flex-wrap gap-2 ${solo ? "hidden" : ""}`}>
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
                    className={`pill inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-card border px-3 font-mono text-sm ${picker ? "rounded-r-none" : ""} ${on ? "border-brand bg-brand text-paper hover:border-brand-deep hover:bg-brand-deep" : a.ready ? "border-strong hover:border-ink active:bg-wash" : "border-dashed border-strong text-muted hover:border-ink"}`}
                  >
                    @{a.handle}
                    {!a.ready && <span className="font-sans text-xs">no voice yet</span>}
                  </button>
                  {picker && (
                    <select
                      aria-label={`Pillar for @${a.handle}`}
                      value={pillarOf[a.handle] ?? ""}
                      onChange={(e) => setPillarOf((p) => ({ ...p, [a.handle]: e.target.value }))}
                      className="field tight pill min-h-10 w-auto rounded-l-none border-l-0 border-brand bg-brand-wash text-xs font-medium text-brand hover:border-brand-deep"
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

          <form
            className={`flex min-h-0 flex-1 flex-col gap-3 ${solo ? "" : "mt-4"}`}
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <Head n={2} shown={step(2)} current={current} title="Your thought">
              {solo && (
                <button type="button" className="link" onClick={() => openUpkeep("posts", accounts[0]!.handle)}>
                  Teach the voice
                </button>
              )}
            </Head>
            <textarea
              ref={thought}
              id="thought"
              aria-labelledby="step-2"
              rows={3}
              value={seed}
              onChange={(e) => {
                setSeed(e.target.value);
                setNudge(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  run();
                }
              }}
              placeholder="What's on your mind? A thought, something you noticed, a link."
              maxLength={4000}
              className="field min-h-20 flex-1 resize-none"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="segmented" style={{ "--at": format === "single" ? 0 : 1 } as React.CSSProperties} role="group" aria-label="Format">
                <span aria-hidden="true" />
                <button type="button" aria-pressed={format === "single"} onClick={() => setFormat("single")}>
                  Single post
                </button>
                <button type="button" aria-pressed={format === "thread"} onClick={() => setFormat("thread")}>
                  Thread
                </button>
              </span>
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
                        className={`pill min-h-9 rounded-[6px] border px-2.5 text-sm ${on ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-strong hover:text-ink"}`}
                      >
                        {p || "Any topic"}
                      </button>
                    );
                  })}
                </span>
              )}
            </div>
            {/* Red from the first moment: this is the one action. Pressed too early, it says what is missing. */}
            <button type="submit" className={`btn mt-1 py-3.5 text-base ${repeat ? "" : "btn-primary"}`} disabled={working}>
              {label}
            </button>
            <p className={`text-sm ${nudge ? "font-medium text-ink" : "text-muted"}`} aria-live="polite">
              {hint}
            </p>
          </form>
        </section>

        <section aria-label="The post" className={`flex min-h-0 flex-col gap-3 p-4 lg:border-l lg:border-line lg:p-6 ${face === "thought" ? "max-lg:hidden" : ""}`}>
          <Head n={3} shown={step(3)} current={current} title="Pick one">
            {/* On a phone the chosen author tab right below already names the account. */}
            {viewSet && <p className="min-w-0 truncate text-sm text-muted max-sm:hidden">Approve or reject to teach @{view}.</p>}
          </Head>

          {authors.length > 1 && (
            <fieldset className="flex min-w-0 flex-wrap gap-1.5">
              <legend className="sr-only">Whose drafts</legend>
              {authors.map((h) => (
                <label
                  key={h}
                  className={`pill inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-card border px-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${h === view ? "border-brand bg-brand-wash text-brand" : "border-strong hover:border-ink active:bg-wash"}`}
                >
                  <input type="radio" name="author" value={h} checked={h === view} onChange={() => setShown(h)} className="sr-only" />
                  <span className="font-mono text-sm">@{h}</span>
                  {/* Only a state worth noticing is named; five drafts waiting is the normal case. */}
                  {/* A failure is state, so it is a black tag; red never warns. */}
                  {errors[h] && !busy[h] ? (
                    <span className="tag">failed</span>
                  ) : (
                    (busy[h] || picked(h)) && <span className={`text-xs ${h === view ? "" : "text-muted"}`}>{busy[h] ? "drafting" : "picked"}</span>
                  )}
                </label>
              ))}
            </fieldset>
          )}

          {viewSet && (
            <fieldset className="flex min-w-0 flex-wrap border-b border-line max-sm:justify-between">
              <legend className="sr-only">Angle</legend>
              {Object.keys(ANGLES).map((name) => {
                const d = viewSet.drafts.find((x) => x.angle === name);
                const s = d && statusOf(d);
                return (
                  <label key={name} title={ANGLES[name]} className={`tab max-sm:px-0 max-sm:tracking-[0.03em] ${s === "rejected" ? "line-through" : ""}`}>
                    <input type="radio" name="angle" value={name} checked={angle === name} onChange={() => setAngle(name)} className="sr-only" />
                    {name}
                    {s === "approved" && <span aria-hidden="true" className="size-1.5 rounded-full bg-ink" />}
                    {s && s !== "draft" && <span className="sr-only">, {s}</span>}
                  </label>
                );
              })}
            </fieldset>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            {!view ? (
              <Notice text="No drafts yet. Give me a thought to study." />
            ) : busy[view] ? (
              <Notice blink text="Studying the human." note="Five angles are coming: story, contrarian, observation, lesson, question." />
            ) : errors[view] ? (
              <Notice text="Signal lost. Try again." note={errors[view]} alert>
                <button type="button" className="btn" onClick={() => run([view])}>
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
                  onOpenStudio={onOpenStudio}
                  onDecided={(status) => setDecided((all) => ({ ...all, [d.id]: status }))}
                />
              )),
            )}
          </div>
        </section>
      </main>

      <footer className="row-start-3 flex items-baseline justify-between gap-4 text-xs text-snow-muted max-lg:hidden">
        <p>Drafts in your voice. You post.</p>
        <p className="font-semibold text-snow">alienX</p>
      </footer>

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

// A step's heading, signed like a wayfinding panel: the step to do now is red,
// finished steps are black, and the ones still ahead are grey.
function Head({ n, shown = n, current, title, children }: { n: number; shown?: number; current: number; title: string; children?: React.ReactNode }) {
  const tone = n === current ? "text-brand" : n < current ? "text-ink" : "text-strong";
  return (
    <div className="flex items-baseline justify-between gap-x-4">
      <h2 id={`step-${n}`} aria-current={n === current ? "step" : undefined} className="flex shrink-0 items-baseline gap-2.5 text-lg leading-tight font-medium">
        <span aria-hidden="true" className={`font-mono transition-colors duration-150 motion-reduce:transition-none ${tone}`}>
          {shown}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// Empty, loading and failed states fill the post face. The eyes blink only while drafts are being made.
function Notice({ text, note, blink = false, alert = false, children }: { text: string; note?: string; blink?: boolean; alert?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center" role={alert ? "alert" : undefined} aria-live={alert ? undefined : "polite"}>
      <Mascot blink={blink} className={`size-14 ${blink ? "text-brand" : "text-muted"}`} />
      <p className={blink || alert ? "font-medium" : "text-muted"}>{text}</p>
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
  onOpenStudio,
  onDecided,
}: {
  draft: Draft;
  allow: Allow;
  picked: boolean;
  hidden: boolean;
  account?: AccountInfo;
  onOpenStudio?: () => void;
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

  const decide = (next: Status) =>
    start(async () => {
      if (next === "draft" && scheduled) {
        // Undo takes the post off the schedule first; if it already went out, the draft stays scheduled.
        const off = await changePostAction({ do: "kill", id: scheduled.id });
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

  // Schedule: approve the draft and put it on the account's next free slot. Its image is
  // drawn in the background and shows up in the Studio when it is ready.
  const schedule = () =>
    start(async () => {
      const result = await scheduleAction({ id: draft.id, handle: draft.handle, posts, claims: draft.claims });
      setFailed(Boolean(result.error));
      if (result.error || !result.post) return;
      setScheduled({ id: result.post.id, at: result.post.scheduled_at });
      navigator.vibrate?.(12); // a small knock on phones, as the stamp lands
      setStatus("approved");
      onDecided("approved");
      void fetch("/api/art", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: result.post.id }) });
    });

  return (
    <article hidden={hidden} aria-label={`${draft.angle}: ${ANGLES[draft.angle]}`} className="flex min-h-0 flex-1 flex-col gap-3 pt-1">
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
                `${draft.claims.length === 1 ? "1 claim" : `${draft.claims.length} claims`}, from the facts or your thought`
              )}
            </button>
            <div id={`claims-${draft.id}`} popover="auto" className="claims-pop">
              <p className="mb-3 text-sm">
                {unverified > 0
                  ? `${unverified === 1 ? "1 claim is" : `${unverified} claims are`} not in the facts or your thought. Check before posting.`
                  : "Every claim traces to the facts or your thought."}
              </p>
              <ul className="grid gap-2 text-sm">
                {draft.claims.map((c, i) => (
                  <li key={i} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                    <span className={c.source === "unverified" ? "tag justify-self-start" : "font-mono text-xs leading-5 text-muted"}>{c.source === "seed" ? "your thought" : c.source}</span>
                    <span className={c.source === "unverified" ? "" : "text-muted"}>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* One row of actions. A decision, the reject reason and the saved note all take its place. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {status !== "draft" ? (
          <>
            <span className={`stamp ${status === "approved" ? "stamp-solid" : ""}`}>{status === "approved" && scheduled ? "scheduled" : status}</span>
            {/* The sentence sits under the row, so Copy and Open in X stay where they were. On a phone
                the stamp says it; the sentence stays for screen readers. */}
            <span className="order-last basis-full text-sm text-muted max-sm:sr-only">{status === "approved" ? (scheduled ? `On the schedule for ${when(scheduled.at)} IST. Its image is being drawn.` : "Saved. The next drafts learn from this.") : "Saved with your reason. The next drafts avoid this."}</span>
            {scheduled && onOpenStudio && (
              <button type="button" className="link" onClick={onOpenStudio}>
                See it in Studio
              </button>
            )}
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
            <button type="button" className="btn btn-primary" disabled={busy || long >= 0} onClick={schedule}>
              Schedule
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          </>
        )}
        {!rejecting && (
          <span className="ml-auto flex gap-2">
            <Copy text={text} />
            {count > LIMIT ? (
              // X would refuse it. The note above says what to do.
              <button type="button" className="btn" disabled>
                Post now
              </button>
            ) : (
              <a className="btn" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                Post now
              </a>
            )}
          </span>
        )}
        {failed && (
          <p className="basis-full text-sm font-medium" role="alert">
            Signal lost. Try again.
          </p>
        )}
      </div>
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
