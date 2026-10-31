"use client";

// The whole site: three views on one dark ground, switched by the dock. Nothing scrolls;
// each view fits the window. Views stay mounted, so drafts in progress survive a switch.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Finding, Post, Topic } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import Dock from "./bits/Dock.tsx";
import { Mascot } from "./mascot.tsx";
import { Profiles } from "./profiles.tsx";
import { Studio } from "./studio.tsx";
import { Topics } from "./topics.tsx";
import { Week } from "./week.tsx";

type View = "week" | "write" | "topics";
const VIEWS: View[] = ["week", "write", "topics"];
const STORE = "alienx.view";
const PROFILE = "alienx.profile";
// The order the profiles stand in: the brand first, then the founders.
const ORDER = ["iamqalakaar", "dibakaarr", "anshsarkar_"];

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[55%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS: Record<View, React.ReactNode> = {
  // A week page with a pin; a pencil; a magnifier over a page.
  week: icon("M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4M8 14h2M12 14h2M16 14h0.5M8 17h2"),
  write: icon("M5 19l1-4L16.5 4.5a2 2 0 0 1 3 3L9 18zM14 7l3 3M5 19h14"),
  topics: icon("M10.5 17a6.5 6.5 0 1 1 4.6-1.9L20 20M8 10.5h5M10.5 8v5"),
};
const LABELS: Record<View, string> = { week: "Studio", write: "Write", topics: "Topics" };

export function Shell({
  accounts,
  posts,
  topics,
  sources,
  now,
}: {
  accounts: AccountInfo[];
  posts: Post[];
  topics: Topic[];
  sources: Record<number, Finding[]>;
  now: string;
}) {
  const [view, setView] = useState<View>("week");
  // Who is posting: one handle, "all", or nobody yet (the chooser shows). Each device remembers its own.
  const [profile, setProfile] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const ordered = [...accounts].sort((a, b) => (ORDER.indexOf(a.handle) + 1 || 99) - (ORDER.indexOf(b.handle) + 1 || 99));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE) as View | null;
      if (saved && VIEWS.includes(saved)) setView(saved);
      const who = localStorage.getItem(PROFILE);
      if (who === "all" || accounts.some((a) => a.handle === who)) setProfile(who);
    } catch {
      // No storage: start on the chooser and the Studio.
    }
    setReady(true);
    // Once, on load: the minute refresh hands over new account objects and must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (who: string | null) => {
    setProfile(who);
    try {
      if (who) localStorage.setItem(PROFILE, who);
      else localStorage.removeItem(PROFILE);
    } catch {
      // Nothing to remember it in.
    }
  };

  // Slots come due while the page is open, so it fetches fresh data every minute.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  const go = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(STORE, v);
    } catch {
      // Nothing to remember it in.
    }
  };

  // Until the device's choice is read, show nothing rather than flash the wrong screen.
  if (!ready) return <div className="h-dvh" />;
  if (!profile)
    return (
      <div className="h-dvh overflow-hidden">
        <h1 className="sr-only">alienX</h1>
        <Profiles accounts={ordered} posts={posts} onPick={pick} />
      </div>
    );

  // Inside a profile everything is that account only; "all" is the combined view.
  const mine = profile === "all" ? ordered : ordered.filter((a) => a.handle === profile);
  const own = (h: string) => profile === "all" || h === profile;
  const myPosts = posts.filter((p) => own(p.handle));
  const myTopics = topics.filter((t) => own(t.handle));
  const me = mine.length === 1 ? mine[0]! : null;
  const due = myPosts.filter((p) => p.status === "due").length;
  const badges: Record<View, number> = { week: due, write: 0, topics: myTopics.length };

  return (
    <div className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">alienX{me ? `, ${me.name}` : ", all three"}</h1>
      {/* Keyed by profile, so switching starts each view fresh for that account. */}
      <div hidden={view !== "week"} className="view h-full">
        <Week key={profile} accounts={mine} posts={myPosts} sources={sources} now={now} />
      </div>
      <div hidden={view !== "write"} className="view h-full">
        <Studio key={profile} accounts={mine} onOpenStudio={() => go("week")} />
      </div>
      <div hidden={view !== "topics"} className="view h-full">
        <Topics key={profile} accounts={mine} topics={myTopics} />
      </div>
      <nav aria-label="Views">
        <Dock
          baseItemSize={46}
          magnification={62}
          panelHeight={62}
          items={[
            ...VIEWS.map((v) => ({
              icon: ICONS[v],
              label: LABELS[v],
              active: view === v,
              badge: badges[v] ? String(badges[v]) : undefined,
              onClick: () => go(v),
            })),
            { separator: true },
            {
              // The current profile; pressing it goes back to the chooser.
              icon: me ? (
                me.type === "brand" ? <Mascot className="size-[55%] text-brand" /> : <span className="text-[0.8em] font-bold">{me.name.slice(0, 1)}</span>
              ) : (
                <span className="text-[0.5em] font-bold">All</span>
              ),
              label: `${me ? me.name : "All three"}: switch profile`,
              onClick: () => pick(null),
            },
          ]}
        />
      </nav>
    </div>
  );
}
