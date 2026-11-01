// One small status language for every screen: a mark per state, so a post's state reads at a
// glance without words. Each mark carries its name for screen readers and as a tooltip.
// Colour comes from the surrounding text, except due, which is always red.
import type { Post } from "../lib/db.ts";
import { Mascot } from "./mascot.tsx";

export type StatusKind = "booked" | "pick" | "due" | "posted" | "noart" | "claims";

const NAMES: Record<StatusKind, { label: string; word: string }> = {
  booked: { label: "Booked", word: "Booked" },
  pick: { label: "alienX pick", word: "Pick" },
  due: { label: "Due now", word: "Due" },
  posted: { label: "Posted", word: "Posted" },
  noart: { label: "No picture yet", word: "No picture" },
  claims: { label: "Claims to check", word: "Check" },
};

export function StatusMark({ kind, size = 12, className = "" }: { kind: StatusKind; size?: number; className?: string }) {
  const { label } = NAMES[kind];
  return (
    <span role="img" aria-label={label} title={label} className={`inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      {kind === "booked" && <span className="size-[62%] rounded-[1px] bg-current" />}
      {kind === "pick" && <Mascot className="size-full" />}
      {kind === "due" && <span className="size-[70%] animate-pulse rounded-full bg-brand motion-reduce:animate-none" />}
      {kind === "noart" && <span className="size-[80%] rounded-[2px] border border-dashed border-current" />}
      {kind === "posted" && (
        <svg viewBox="0 0 12 12" className="size-full" aria-hidden="true">
          <path d="M2 6.4 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === "claims" && (
        <svg viewBox="0 0 12 12" className="size-full" aria-hidden="true">
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 3.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="6" cy="8.6" r="0.8" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

// The marks a post wears: its state first, then what alienX did or what is still missing.
// A posted post is done, so a missing picture or an unchecked claim no longer counts.
export function marksFor(post: Post): StatusKind[] {
  const out: StatusKind[] = [];
  if (post.status === "due") out.push("due");
  else if (post.status === "posted") out.push("posted");
  else if (post.status === "scheduled") out.push("booked");
  if (post.picked) out.push("pick");
  if (post.status !== "posted") {
    if (!post.art) out.push("noart");
    if (post.claims.some((c) => c.source === "unverified")) out.push("claims");
  }
  return out;
}

// One compact row: each mark with its one-word name.
export function Legend({ kinds = ["booked", "pick", "due", "posted", "noart"], className = "" }: { kinds?: StatusKind[]; className?: string }) {
  return (
    <ul aria-label="What the marks mean" className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold ${className}`}>
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-1">
          <StatusMark kind={k} size={11} />
          <span aria-hidden="true">{NAMES[k].word}</span>
        </li>
      ))}
    </ul>
  );
}
