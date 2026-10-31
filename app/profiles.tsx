"use client";

// The first screen after the Cloudflare login: who is posting. One torn sheet per account,
// with what needs it; "All three" opens the combined week. Profiles are a view, not a
// permission: the one login covers everyone.
import type { Post } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import { Mascot } from "./mascot.tsx";

export function Profiles({ accounts, posts, onPick }: { accounts: AccountInfo[]; posts: Post[]; onPick: (handle: string) => void }) {
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-6 p-4 sm:p-8">
      <header className="flex items-center gap-4">
        <Mascot className="size-9 text-brand" />
        <div>
          <h2 className="text-2xl leading-tight font-bold tracking-[-0.03em]">Who is posting?</h2>
          <p className="text-sm text-snow-muted">Pick a profile. You can switch any time from the dock.</p>
        </div>
      </header>

      <main className="rise grid content-center gap-6 sm:grid-cols-3 lg:mx-auto lg:w-full lg:max-w-5xl">
        {accounts.map((a, i) => {
          const mine = posts.filter((p) => p.handle === a.handle);
          const due = mine.filter((p) => p.status === "due").length;
          const coming = mine.filter((p) => p.status === "scheduled").length;
          return (
            <button
              key={a.handle}
              type="button"
              data-press
              onClick={() => onPick(a.handle)}
              style={{ "--r": `${(i - 1) * 1.2}deg`, "--i": i } as React.CSSProperties}
              className={`sheet ${["", "sheet-b", "sheet-c"][i % 3]} tape grid cursor-pointer justify-items-center gap-3 px-6 pt-10 pb-7 text-center hover:[rotate:0deg] hover:-translate-y-1 max-sm:grid-cols-[auto_1fr] max-sm:justify-items-start max-sm:gap-x-4 max-sm:pt-7 max-sm:text-left`}
            >
              <span className={`grid size-20 place-items-center rounded-full text-3xl font-bold max-sm:row-span-3 max-sm:size-14 max-sm:text-2xl ${a.type === "brand" ? "bg-brand text-paper" : "bg-ink text-paper"}`}>
                {a.type === "brand" ? <Mascot className="size-11 max-sm:size-8" /> : a.name.slice(0, 1)}
              </span>
              <span className="text-xl font-bold tracking-[-0.02em]">{a.name}</span>
              <span className="text-sm text-muted">@{a.handle}</span>
              <span className="text-sm">
                {due > 0 ? <span className="font-semibold text-brand">{due === 1 ? "1 post due" : `${due} posts due`}</span> : <span className="text-muted">{coming === 1 ? "1 on the schedule" : `${coming} on the schedule`}</span>}
              </span>
            </button>
          );
        })}
      </main>

      <footer className="flex justify-center">
        <button type="button" className="btn btn-ground" onClick={() => onPick("all")}>
          All three
        </button>
      </footer>
    </div>
  );
}
