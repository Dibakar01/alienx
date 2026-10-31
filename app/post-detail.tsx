"use client";

// One scheduled post, opened over the Studio: its image beside a short checklist of the
// posting steps in order (check the words, post to X, add the source as the first reply,
// mark it posted), then the quieter extras (draw again, download, move, kill).
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { Finding, Post } from "../lib/db.ts";
import { LIMIT, problems, weighted } from "../lib/post.ts";
import { when } from "../lib/time.ts";
import type { AccountInfo } from "./accounts.tsx";
import { changePostAction } from "./actions.ts";
import { startJob } from "./activity.tsx";
import { Working } from "./working.tsx";
import { XPreview } from "./x-preview.tsx";

const SOURCE: Record<string, string> = { facts: "facts", seed: "your thought", research: "research", unverified: "unverified" };

export function PostDetail({
  post,
  account,
  sources,
  today,
  onClose,
  onKill,
  onSaved,
  onChanged,
}: {
  post: Post | null;
  account: AccountInfo | undefined;
  sources: Finding[];
  today: string;
  onClose: () => void;
  onKill: (p: Post) => void;
  onSaved: (text: string) => void;
  onChanged: (p: Post) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [posts, setPosts] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [art, setArt] = useState("");
  const [drawing, setDrawing] = useState(0); // when a redraw started, 0 when idle
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false); // Post to X was tapped in this sitting
  const [replied, setReplied] = useState(false); // the first reply was copied
  const [busy, start] = useTransition();
  const [loaded, setLoaded] = useState<Post | null>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const words = useRef<HTMLTextAreaElement>(null);
  const claimsBox = useRef<HTMLDetailsElement>(null);
  const [focusWords, setFocusWords] = useState(false); // Edit the words was pressed: focus once the page shows

  // Opening a post loads its text and starts the steps over. Done while rendering, not in an
  // effect, so the first frame already shows this post's steps instead of flashing the last one's.
  // Saving an edit hands back the same post with a new identity: the text reloads, but the
  // ticks for Post to X and the reply stay, since those were already done in this sitting.
  if (post && post !== loaded) {
    if (post.id !== loaded?.id) {
      setSent(false);
      setReplied(false);
    }
    setLoaded(post);
    setPosts(post.posts);
    setPage(0);
    setError("");
    setArt(post.art && typeof post.art === "object" && "seed" in post.art ? String((post.art as { seed: number }).seed) : "");
  }

  // Closing it with Esc or the backdrop tells the Studio.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (post) {
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [post]);

  // A failed save in step 1 shows its message under the whole checklist; bring it into view.
  useEffect(() => {
    if (error) alert.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  // Edit the words may switch to another post in a thread first, so focus after that renders.
  useEffect(() => {
    if (!focusWords) return;
    setFocusWords(false);
    words.current?.focus();
    words.current?.scrollIntoView({ block: "nearest" });
  }, [focusWords]);

  if (!post) return <dialog ref={ref} onClose={onClose} className="hidden" />;

  const allow = { hashtags: false, emoji: account?.emoji ?? false, banned: account?.banned ?? [] };
  const text = posts[page] ?? "";
  const flags = problems(text, allow);
  const dirty = JSON.stringify(posts) !== JSON.stringify(post.posts);
  const tooLong = posts.some((p) => weighted(p) > LIMIT);
  const posted = post.status === "posted";
  const unverified = post.claims.filter((c) => c.source === "unverified").length;

  const redraw = async () => {
    const done = startJob({ handle: post.handle, label: `Drawing a new picture for @${post.handle}`, kind: "picture", where: "week", typical: 35 });
    setDrawing(Date.now());
    setError("");
    const r = (await fetch("/api/art", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: post.id }) })
      .then((x) => x.json())
      .catch((e: unknown) => ({ error: String(e) }))) as { post?: Post; error?: string };
    setDrawing(0);
    done(r.error || !r.post ? { ok: false, text: "The new picture did not draw." } : { ok: true, text: "New picture ready." });
    if (r.error || !r.post) return setError(r.error ?? "No image came back.");
    setArt(String((r.post.art as { seed: number }).seed) + "-" + Date.now());
  };

  const save = () =>
    start(async () => {
      const r = await changePostAction({ do: "edit", id: post.id, posts });
      if (r.error || !r.post) return setError(r.error ?? "Not saved.");
      onChanged(r.post);
      onSaved("Saved.");
    });

  const moveTo = (day: string) =>
    start(async () => {
      const r = await changePostAction({ do: "move", id: post.id, day });
      if (r.error || !r.post) return setError(r.error ?? "Not moved.");
      onSaved(`Moved to ${when(r.post.scheduled_at)}.`);
      onClose();
    });

  const markPosted = () =>
    start(async () => {
      const r = await changePostAction({ do: "posted", id: post.id });
      if (r.error) return setError(r.error);
      onSaved("Marked as posted. The voice learns from it.");
      onClose();
    });

  // The posting steps, in order. Each is done, the one to do now, or still to come; the
  // first one not done is "now". Words are done when nothing is unsaved and nothing runs over.
  const order: StepKey[] = ["check", "post", ...(sources.length > 0 ? (["reply"] as const) : []), "mark"];
  const finished: Record<StepKey, boolean> = { check: !dirty && !tooLong, post: sent, reply: replied, mark: false };
  const current = order.find((k) => !finished[k]) ?? "mark";
  const stateOf = (k: StepKey): StepState => (finished[k] ? "done" : k === current ? "now" : "next");
  const number = (k: StepKey) => order.indexOf(k) + 1;

  const showClaims = () => {
    if (!claimsBox.current) return;
    claimsBox.current.open = true;
    claimsBox.current.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const copyReply = () =>
    navigator.clipboard
      .writeText(firstReply(sources))
      .then(() => setReplied(true))
      .catch(() => setError("The first reply was not copied. Copy it from its step below."));

  // alienX's own read of the post, from real signals only: things to look at, then plain notes.
  const checks: Check[] = [];
  posts.forEach((p, i) => {
    const f = problems(p, allow);
    if (f.length)
      checks.push({ id: `rules-${i}`, issue: true, text: `${posts.length > 1 ? `Post ${i + 1} breaks` : "Breaks"} ${f.length === 1 ? "a rule" : `${f.length} rules`}: ${f.join(", ")}.`, fix: { label: "Edit the words", do: () => {
          setPage(i);
          setFocusWords(true);
        } } });
  });
  if (unverified) checks.push({ id: "claims", issue: true, text: `${unverified === 1 ? "One claim is" : `${unverified} claims are`} not verified yet.`, fix: { label: "Show the claims", do: showClaims } });
  if (!art) checks.push({ id: "art", issue: true, text: drawing ? "Drawing the picture now." : "No picture yet.", fix: { label: "Draw the picture", do: redraw, off: drawing > 0 } });
  if (dirty) checks.push({ id: "dirty", issue: true, text: "You have unsaved edits.", fix: { label: "Save changes", do: save, off: busy || tooLong } });
  // alienX booked it by itself: one tap says yes, and every "review it" reminder goes away.
  if (post.picked && !posted)
    checks.push({
      id: "picked",
      issue: false,
      text: "alienX picked this for you. Keep it, or change it first.",
      fix: {
        label: "Keep it",
        off: busy,
        do: () =>
          start(async () => {
            const r = await changePostAction({ do: "keep", id: post.id });
            if (r.error || !r.post) return setError(r.error ?? "Not kept.");
            onChanged(r.post);
            onSaved("Kept. alienX will stop asking about it.");
          }),
      },
    });
  if (posts.length > 1) checks.push({ id: "thread", issue: false, text: `A thread of ${posts.length} posts. X takes one post per tap.` });
  if (sources.length) checks.push({ id: "reply", issue: false, text: replied ? "First reply copied." : "The first reply with the source is ready.", fix: replied ? undefined : { label: "Copy first reply", do: copyReply } });
  const issues = checks.filter((c) => c.issue).length;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="post-title"
      className="m-auto w-[min(60rem,calc(100%-1.5rem))] overflow-visible bg-transparent p-0 text-ink"
    >
      {/* The torn sheet is a wrapper: a dialog must keep its own positioning. */}
      <div className="sheet sheet-c tape">
      <div className="grid max-h-[calc(100dvh-1.5rem)] gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex items-baseline justify-between gap-4 lg:col-span-2">
          <div className="min-w-0">
            <h2 id="post-title" className="text-xl leading-tight font-bold tracking-[-0.022em]">
              @{post.handle}
            </h2>
            <p className="text-sm text-muted">
              {posted ? "Posted." : post.status === "due" ? <span className="font-semibold text-brand">Due now. Post it when you are ready.</span> : `Goes out ${when(post.scheduled_at)} IST, unless you change it.`}{" "}
              {post.picked ? "alienX picked this idea for you." : post.source === "plan" ? "From a discovered idea." : "From your own idea."}
              {post.angle ? ` ${post.angle[0]!.toUpperCase()}${post.angle.slice(1)}` : ""}
              {post.pillar ? ` · ${post.pillar}.` : post.angle ? "." : ""}
            </p>
          </div>
          <form method="dialog">
            <button type="submit" className="btn">
              Close
            </button>
          </form>
        </div>

        {/* As the feed will show it: the words as they stand now, and the image. On a laptop it
            stays in view while the steps beside it scroll; on a phone it follows the steps, so
            Post to X is near the top. */}
        <figure className="relative order-last self-start lg:sticky lg:top-0 lg:order-none">
          <div className={drawing ? "opacity-60" : ""}>
            <XPreview
              name={account?.name ?? post.handle}
              handle={post.handle}
              brand={account?.type === "brand"}
              text={text}
              image={art ? `/api/art?id=${post.id}&v=${art}` : null}
              note={drawing ? " " : posted ? "No image." : "No image yet. Use Draw the image, under More."}
            />
          </div>
          {drawing > 0 && (
            <span className="absolute inset-0 grid place-items-center p-4">
              <span className="sheet max-w-xs px-4 py-3">
                <Working compact kind="picture" title="Drawing the picture" note="Picking a visual metaphor for the post, then drawing it. About half a minute." since={drawing} />
              </span>
            </span>
          )}
        </figure>

        <div className="grid content-start gap-4">
          {/* What alienX found, with a one-tap fix beside each thing. Calm ink: the red stays on the step to do. */}
          {!posted && (
            <section aria-labelledby="post-check" className="grid gap-2 rounded-[10px] border border-line bg-paper p-3">
              <h3 id="post-check" className="label">
                alienX checked this
              </h3>
              <p role="status" className="text-[15px] leading-snug font-semibold text-ink">
                {issues === 0 ? "Ready to post." : `${issues === 1 ? "One thing" : `${issues} things`} to look at before posting.`}
              </p>
              {checks.length > 0 && (
                <ul className="grid gap-1.5 text-sm">
                  {checks.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span aria-hidden="true" className={`size-2 shrink-0 rounded-[2px] ${c.issue ? "bg-ink" : "border border-strong"}`} />
                      <span className={`min-w-0 flex-1 ${c.issue ? "text-ink" : "text-muted"}`}>{c.text}</span>
                      {c.fix && (
                        <button type="button" className="btn px-2.5 py-1" onClick={c.fix.do} disabled={c.fix.off}>
                          {c.fix.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* The checklist: one step after the other, each with one button. */}
          <ol aria-label="Steps to post" className="grid gap-1">
            <Step
              n={number("check")}
              state={posted ? "done" : stateOf("check")}
              title={posted ? "The words" : "Check the words"}
              hint={posted ? undefined : tooLong ? "Too long for X. Cut it down, then save." : dirty ? "Save your changes. Posting waits for them." : "Ready as it stands. Edit here if you want a change."}
            >
              {posts.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="label">
                    Post {page + 1} of {posts.length}
                  </span>
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
              <textarea
                aria-label="Post text"
                ref={words}
                rows={5}
                value={text}
                disabled={posted}
                onChange={(e) => setPosts(posts.map((p, j) => (j === page ? e.target.value : p)))}
                className="field resize-none font-post text-[15px] leading-[1.4]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs tabular-nums ${weighted(text) > LIMIT ? "tag" : "text-muted"}`}>
                  {weighted(text)} / {LIMIT}
                </span>
                {flags.map((f) => (
                  <span key={f} className="tag">
                    {f}
                  </span>
                ))}
                {dirty && !posted && (
                  <button type="button" className="btn btn-dark ml-auto" onClick={save} disabled={busy || tooLong}>
                    Save changes
                  </button>
                )}
              </div>
              {post.claims.length > 0 && (
                <details ref={claimsBox} className="scroll-mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold">
                    {unverified > 0 ? `${unverified === 1 ? "1 claim" : `${unverified} claims`} to check` : `${post.claims.length === 1 ? "1 claim" : `${post.claims.length} claims`}, all sourced`}
                  </summary>
                  <ul className="mt-2 grid gap-1.5">
                    {post.claims.map((c, i) => (
                      <li key={i} className="grid gap-x-3 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                        <span className={c.source === "unverified" ? "tag justify-self-start" : "text-xs font-semibold text-muted"}>{SOURCE[c.source]}</span>
                        <span className={c.source === "unverified" ? "" : "text-muted"}>{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Step>

            {!posted && (
              <>
                <Step n={number("post")} state={stateOf("post")} title="Post to X" hint="One tap opens X with the words, and the image comes with them.">
                  <div className="flex flex-wrap items-center gap-2">
                    <PostButton post={post} text={text} art={art} disabled={tooLong || dirty} quiet={stateOf("post") !== "now"} onSent={() => setSent(true)} />
                  </div>
                  {dirty && <p className="text-xs text-muted">Save your changes before posting.</p>}
                  {posts.length > 1 && <p className="text-xs text-muted">X takes one post per tap. Post the first, then reply to it with the rest, copying each from step 1.</p>}
                </Step>

                {sources.length > 0 && (
                  <Step n={number("reply")} state={stateOf("reply")} title="Add the source as the first reply" hint="Reply to your own post with it, so the post itself keeps readers on X.">
                    <FirstReply sources={sources} onCopied={() => setReplied(true)} />
                    <Sources sources={sources} />
                  </Step>
                )}

                <Step n={number("mark")} state={stateOf("mark")} title="Mark as posted" hint="Tell alienX it is out. The voice learns from it.">
                  <div>
                    <button type="button" className={`btn ${stateOf("mark") === "now" ? "btn-primary" : ""}`} onClick={markPosted} disabled={busy}>
                      I posted it
                    </button>
                  </div>
                </Step>
              </>
            )}
          </ol>

          {posted && (
            <div className="grid justify-items-start gap-3 border-t border-line pt-3">
              <span className="stamp stamp-solid">posted</span>
              {sources.length > 0 && <Sources sources={sources} />}
            </div>
          )}

          {error && (
            <p ref={alert} role="alert" className="text-sm font-semibold">
              Signal lost. {error}
            </p>
          )}

          {/* Everything else, quieter and out of the way of the steps. */}
          {(!posted || art) && (
            <section aria-labelledby="post-more" className="grid gap-2.5 rounded-[10px] border border-dashed border-strong p-3">
              <h3 id="post-more" className="label">
                More
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {!posted && (
                  <button type="button" className="btn" onClick={redraw} disabled={drawing > 0}>
                    {art ? "Draw again" : "Draw the image"}
                  </button>
                )}
                {art && (
                  <a className="btn" href={`/api/art?id=${post.id}`} download={`alienx-${post.id}.png`}>
                    Download
                  </a>
                )}
                {!posted && (
                  <button type="button" className="btn ml-auto" onClick={() => onKill(post)} disabled={busy}>
                    Kill
                  </button>
                )}
              </div>
              {!posted && (
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">Move to a day</span>
                  <input type="date" min={today} defaultValue="" onChange={(e) => e.target.value >= today && moveTo(e.target.value)} className="field w-auto py-1.5" />
                  <span className="text-muted">It keeps its time of day.</span>
                </label>
              )}
            </section>
          )}
        </div>
      </div>
      </div>
    </dialog>
  );
}

type StepKey = "check" | "post" | "reply" | "mark";
type Check = { id: string; issue: boolean; text: string; fix?: { label: string; do: () => void; off?: boolean } };
type StepState = "done" | "now" | "next";

// One numbered line of the checklist: a marker (red for now, ink with a tick when done,
// outlined when still to come), a pencil line down to the next step, the title and the work.
function Step({ n, state, title, hint, children }: { n: number; state: StepState; title: string; hint?: string; children: ReactNode }) {
  return (
    <li
      aria-current={state === "now" ? "step" : undefined}
      className={`group relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 rounded-[10px] p-2 transition-colors duration-300 ${state === "now" ? "bg-brand-wash" : ""}`}
    >
      <span aria-hidden="true" className="absolute top-9 -bottom-3 left-[1.3rem] border-l border-dashed border-strong group-last:hidden" />
      <span
        aria-hidden="true"
        className={`relative grid size-7 place-items-center rounded-[6px] text-sm font-semibold tabular-nums transition-colors duration-300 ${
          state === "now" ? "bg-brand text-paper" : state === "done" ? "bg-ink text-paper" : "border border-strong bg-paper text-muted"
        }`}
      >
        {state === "done" ? (
          <svg key="tick" viewBox="0 0 16 16" className="roll size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        ) : (
          <span key="n" className="roll">
            {n}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <h3 className={`text-[15px] leading-7 font-semibold ${state === "done" ? "text-muted" : "text-ink"}`}>
          <span className="sr-only">{`Step ${n}${state === "done" ? ", done" : state === "now" ? ", now" : ""}: `}</span>
          {title}
        </h3>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div className={`col-start-2 mt-2.5 grid gap-2.5 transition-opacity duration-300 ${state === "next" ? "opacity-70" : ""}`}>{children}</div>
    </li>
  );
}

// Where the claims come from, as the research found them.
function Sources({ sources }: { sources: Finding[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">{sources.length === 1 ? "1 source" : `${sources.length} sources`} from the research</summary>
      <ul className="mt-2 grid gap-1.5 wrap-anywhere">
        {sources.map((s, k) => (
          <li key={`${k}:${s.url}`}>
            <a href={/^https?:\/\//i.test(s.url) ? s.url : undefined} target="_blank" rel="noreferrer" className="link">
              {s.title}
            </a>
            <span className="block text-muted">{s.claim}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// The one tap. On a laptop it puts the image on the clipboard and opens X with the text, so
// the image goes in with Cmd+V. On a phone it opens the share sheet with the image and the text.
// Once tapped it goes quiet, so the red moves on to the next step.
function PostButton({ post, text, art, disabled, quiet, onSent }: { post: Post; text: string; art: string; disabled: boolean; quiet: boolean; onSent: () => void }) {
  const image = Boolean(art);
  const blob = useRef<Promise<Blob> | null>(null);
  const file = useRef<File | null>(null);
  const [share, setShare] = useState(false);
  const [note, setNote] = useState("");

  // Fetch the image as soon as the post opens, so the tap itself has nothing to wait for.
  // Fetched again whenever the image is redrawn, so the tap always hands over the current one.
  useEffect(() => {
    blob.current = null;
    file.current = null;
    if (!image) return;
    blob.current = fetch(`/api/art?id=${post.id}&v=${art}`).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("No image yet."))));
    blob.current
      .then((b) => {
        file.current = new File([b], `alienx-${post.id}.png`, { type: "image/png" });
        setShare(window.matchMedia("(pointer: coarse)").matches && Boolean(navigator.canShare?.({ files: [file.current] })));
      })
      .catch(() => {});
  }, [post.id, art, image]);

  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

  if (share)
    return (
      <>
      <button
        type="button"
        className={`btn ${quiet ? "" : "btn-primary"}`}
        disabled={disabled}
        onClick={() => {
          if (!file.current) return;
          onSent();
          // Some X builds drop the text when a file comes with it; the clipboard keeps it either way.
          navigator.clipboard?.writeText(text).catch(() => {});
          navigator.share({ files: [file.current], text }).catch((e: unknown) => {
            if (!(e instanceof DOMException && e.name === "AbortError")) setNote("The share sheet did not open. Use Download, then post from X.");
          });
          setNote("If X shows only the image, paste the text: it is on your clipboard.");
        }}
      >
        Post to X
      </button>
      {note && (
        <p role="status" className="basis-full text-sm text-muted">
          {note}
        </p>
      )}
    </>
    );

  return (
    <>
      <a
        className={`btn ${quiet ? "" : "btn-primary"} ${disabled ? "pointer-events-none opacity-50" : ""}`}
        href={intent}
        target="_blank"
        rel="noreferrer"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={(e) => {
          if (disabled) return e.preventDefault();
          onSent();
          if (!blob.current || typeof ClipboardItem === "undefined") return;
          // Written inside the tap, with the image as a promise, so Safari still counts the gesture.
          navigator.clipboard
            .write([new ClipboardItem({ "image/png": blob.current })])
            .then(() => setNote("Image copied. In X, press Cmd+V to add it."))
            .catch(() => setNote("The image was not copied. Use Copy image, then paste it into X."));
        }}
      >
        Post to X
      </a>
      {image && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!blob.current) return;
            navigator.clipboard
              .write([new ClipboardItem({ "image/png": blob.current })])
              .then(() => setNote("Image copied."))
              .catch(() => setNote("Not copied. Use Download instead."));
          }}
        >
          Copy image
        </button>
      )}
      {note && (
        <p role="status" className="basis-full text-sm text-muted">
          {note}
        </p>
      )}
    </>
  );
}

// The source goes in the first reply, so the post itself keeps readers on X. Copy it after
// posting, then reply to your own post with it.
function FirstReply({ sources, onCopied }: { sources: Finding[]; onCopied: () => void }) {
  const [label, setLabel] = useState("Copy first reply");
  const reply = firstReply(sources);
  return (
    <div className="grid gap-2 rounded-[10px] border border-line bg-paper p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="label">The reply</span>
        <button
          type="button"
          className="btn"
          onClick={() =>
            navigator.clipboard
              .writeText(reply)
              .then(() => {
                setLabel("Copied");
                onCopied();
              })
              .catch(() => setLabel("Not copied"))
              .finally(() => setTimeout(() => setLabel("Copy first reply"), 1500))
          }
        >
          {label}
        </button>
      </div>
      <p className="max-h-24 overflow-y-auto font-post text-muted whitespace-pre-wrap wrap-anywhere">{reply}</p>
    </div>
  );
}

// The first reply: the top two sources, title then link.
const firstReply = (sources: Finding[]) =>
  `Source${sources.length > 1 ? "s" : ""}:\n${sources
    .slice(0, 2)
    .map((s) => `${s.title}\n${s.url}`)
    .join("\n\n")}`;
