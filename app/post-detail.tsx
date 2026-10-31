"use client";

// One scheduled post, opened over the Studio: its image, its text (editable until it is
// posted), where its claims come from, when it goes, and the one tap that hands it to X.
import { useEffect, useRef, useState, useTransition } from "react";
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
  const [busy, start] = useTransition();

  // Opening a post loads its text; closing it with Esc or the backdrop tells the Studio.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (post) {
      setPosts(post.posts);
      setPage(0);
      setError("");
      setArt(post.art && typeof post.art === "object" && "seed" in post.art ? String((post.art as { seed: number }).seed) : "");
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [post]);

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

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="post-title"
      className="m-auto w-[min(60rem,calc(100%-1.5rem))] overflow-visible bg-transparent p-0 text-ink"
    >
      {/* The torn sheet is a wrapper: a dialog must keep its own positioning. */}
      <div className="sheet sheet-c">
      <div className="grid max-h-[calc(100dvh-1.5rem)] gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex items-baseline justify-between gap-4 lg:col-span-2">
          <div className="min-w-0">
            <h2 id="post-title" className="text-xl leading-tight font-bold tracking-[-0.022em]">
              @{post.handle}
            </h2>
            <p className="text-sm text-muted">
              {posted ? "Posted." : post.status === "due" ? <span className="font-semibold text-brand">Due now. Post it when you are ready.</span> : `Goes out ${when(post.scheduled_at)} IST, unless you change it.`}{" "}
              {post.picked ? "alienX picked this idea and approved it for you. Change it, move it or remove it before then." : post.source === "plan" ? "From a discovered idea." : "From your own idea."}
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

        <figure className="grid content-start gap-2">
          {/* As the feed will show it: the words as they stand now, and the image. */}
          <div className={`relative ${drawing ? "opacity-60" : ""}`}>
            <XPreview
              name={account?.name ?? post.handle}
              handle={post.handle}
              brand={account?.type === "brand"}
              text={text}
              image={art ? `/api/art?id=${post.id}&v=${art}` : null}
              note={drawing ? " " : "No image yet. Draw one below."}
            />
            {drawing > 0 && (
              <span className="absolute inset-0 grid place-items-center p-4">
                <span className="sheet max-w-xs px-4 py-3">
                  <Working compact kind="picture" title="Drawing the picture" note="Picking a visual metaphor for the post, then drawing it. About half a minute." since={drawing} />
                </span>
              </span>
            )}
          </div>
          <figcaption className="flex flex-wrap items-center gap-2">
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
          </figcaption>
        </figure>

        <div className="grid content-start gap-3">
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
            rows={6}
            value={text}
            disabled={posted}
            onChange={(e) => setPosts(posts.map((p, j) => (j === page ? e.target.value : p)))}
            className="field resize-none font-post text-[15px] leading-[1.4]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted tabular-nums">
              {weighted(text)} / {LIMIT}
            </span>
            {flags.map((f) => (
              <span key={f} className="tag">
                {f}
              </span>
            ))}
            {dirty && (
              <button type="button" className="btn btn-dark ml-auto" onClick={save} disabled={busy || tooLong}>
                Save changes
              </button>
            )}
          </div>

          {post.claims.length > 0 && (
            <details className="text-sm">
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
          {sources.length > 0 && !posted && <FirstReply sources={sources} />}
          {sources.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">{sources.length === 1 ? "1 source" : `${sources.length} sources`} from the research</summary>
              <ul className="mt-2 grid gap-1.5">
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
          )}

          {!posted && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Move to</span>
              <input type="date" min={today} defaultValue="" onChange={(e) => e.target.value >= today && moveTo(e.target.value)} className="field w-auto py-1.5" />
              <span className="text-muted">It keeps its time of day.</span>
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm font-semibold">
              Signal lost. {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {posted ? (
              <span className="stamp stamp-solid">posted</span>
            ) : (
              <>
                <PostButton post={post} text={text} art={art} disabled={tooLong || dirty} />
                <button type="button" className="btn" onClick={markPosted} disabled={busy}>
                  I posted it
                </button>
                <button type="button" className="btn ml-auto" onClick={() => onKill(post)} disabled={busy}>
                  Kill
                </button>
              </>
            )}
          </div>
          {dirty && !posted && <p className="text-xs text-muted">Save your changes before posting.</p>}
          {posts.length > 1 && !posted && <p className="text-xs text-muted">X takes one post per tap. Post the first, then reply to it with the rest, copying each from here.</p>}
        </div>
      </div>
      </div>
    </dialog>
  );
}

// The one tap. On a laptop it puts the image on the clipboard and opens X with the text, so
// the image goes in with Cmd+V. On a phone it opens the share sheet with the image and the text.
function PostButton({ post, text, art, disabled }: { post: Post; text: string; art: string; disabled: boolean }) {
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
        className="btn btn-primary"
        disabled={disabled}
        onClick={() => {
          if (!file.current) return;
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
        className={`btn btn-primary ${disabled ? "pointer-events-none opacity-50" : ""}`}
        href={intent}
        target="_blank"
        rel="noreferrer"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={(e) => {
          if (disabled) return e.preventDefault();
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
function FirstReply({ sources }: { sources: Finding[] }) {
  const [label, setLabel] = useState("Copy first reply");
  const reply = `Source${sources.length > 1 ? "s" : ""}:\n${sources
    .slice(0, 2)
    .map((s) => `${s.title}\n${s.url}`)
    .join("\n\n")}`;
  return (
    <div className="grid gap-2 rounded-[10px] bg-wash p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">First reply, with the source</span>
        <button
          type="button"
          className="btn"
          onClick={() =>
            navigator.clipboard
              .writeText(reply)
              .then(() => setLabel("Copied"))
              .catch(() => setLabel("Not copied"))
              .finally(() => setTimeout(() => setLabel("Copy first reply"), 1500))
          }
        >
          {label}
        </button>
      </div>
      <p className="font-post text-muted whitespace-pre-wrap break-words">{reply}</p>
    </div>
  );
}
