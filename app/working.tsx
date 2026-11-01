"use client";

// The loading state for real work, in one line: a small moving picture of the job, what is
// happening, and a bar for how far along it is. One look for every wait.
import { Bar } from "./activity.tsx";
import { type Kind, Vignette } from "./vignettes.tsx";

export function Working({ kind, title, since, typical = 60, compact = false }: { kind: Kind; title: string; since?: number; typical?: number; compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`grid items-center gap-x-3 gap-y-1.5 ${compact ? "grid-cols-[4.5rem_minmax(0,1fr)]" : "mx-auto w-full max-w-sm grid-cols-[6rem_minmax(0,1fr)] px-2 py-4"}`}>
      <div className="row-span-2 aspect-[5/3] overflow-hidden rounded-[8px] bg-wash">
        <Vignette kind={kind} />
      </div>
      <p className="truncate font-semibold">{title}</p>
      {since ? <Bar since={since} typical={typical} /> : <span />}
    </div>
  );
}
