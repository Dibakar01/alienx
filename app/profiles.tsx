"use client";

// The first screen after the Cloudflare login: who is posting. One torn sheet per account,
// with what needs it; "All three" opens the combined week. Profiles are a view, not a
// permission: the one login covers everyone. With no accounts yet (a fresh clone), it
// offers to add the first one.
import { useRef, useState } from "react";
import type { Post } from "../lib/db.ts";
import { type AccountInfo, Accounts, type Upkeep } from "./accounts.tsx";
import { Mascot } from "./mascot.tsx";

export function Profiles({
  accounts,
  posts,
  onPick,
}: {
  accounts: AccountInfo[];
  posts: Post[];
  onPick: (handle: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [upkeep, setUpkeep] = useState<Upkeep>({ mode: "add", who: accounts[0]?.handle ?? "" });
  const add = () => {
    setUpkeep((u) => ({ ...u, mode: "add" }));
    dialog.current?.showModal();
  };
  const accountsDialog = (
    <Accounts ref={dialog} accounts={accounts} upkeep={upkeep} onChange={setUpkeep} onAdded={() => dialog.current?.close()} />
  );

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

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-6 p-4 sm:p-8">
      <header className="flex items-center gap-4 pr-14">
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

      <footer className="flex flex-wrap items-center justify-center gap-3">
        {accounts.length > 1 && (
          <button type="button" className="btn btn-ground" onClick={() => onPick("all")}>
            {accounts.length === 3 ? "All three" : `All ${accounts.length}`}
          </button>
        )}
        <button type="button" className="link text-snow decoration-snow-line-strong" onClick={add}>
          Add an account
        </button>
      </footer>
      {accountsDialog}
    </div>
  );
}
