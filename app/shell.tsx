"use client";

// The whole site, in the order it is used: the landing page (first visit), who is posting,
// then two views switched by the dock: Create (ideas to an approved post) and Studio (the
// calendar of approved posts, to post from). Nothing scrolls; views stay mounted, so drafts
// in progress survive a switch.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Finding, Post, Topic } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import Dock from "./bits/Dock.tsx";
import { Mascot } from "./mascot.tsx";
import { Profiles } from "./profiles.tsx";
import { ThemeIcon, useTheme } from "./theme.tsx";
import { Landing } from "./landing.tsx";
import { Studio } from "./studio.tsx";
import { Week } from "./week.tsx";

// In the order the work happens: make a post, then schedule and post it.
type View = "write" | "week";
const VIEWS: View[] = ["write", "week"];
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
  // A pencil with a spark; a calendar page.
  write: icon("M5 19l1-4L16.5 4.5a2 2 0 0 1 3 3L9 18zM14 7l3 3M5 19h6M19 14v4M17 16h4"),
  week: icon("M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4M8 14h2M12 14h2M16 14h0.5M8 17h2"),
};
const LABELS: Record<View, string> = { write: "1 Create", week: "2 Studio" };

// One page, turning: when the browser can, a change of view or profile is a View Transition
// (the old page slides out, the new one settles in on the spring); otherwise it just changes.
function turn(change: () => void) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return change();
  document.startViewTransition(() => flushSync(change));
}

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
  const [view, setView] = useState<View>("write");
  // A first visit opens on the landing page; "Get started" moves on to choosing who is posting.
  const [choosing, setChoosing] = useState(false);
  // Who is posting: one handle, "all", or nobody yet (the chooser shows). Each device remembers its own.
  const [profile, setProfile] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, flipTheme] = useTheme();
  const router = useRouter();
  const ordered = [...accounts].sort((a, b) => (ORDER.indexOf(a.handle) + 1 || 99) - (ORDER.indexOf(b.handle) + 1 || 99));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE) as View | null;
      if (saved && VIEWS.includes(saved)) setView(saved);
      // The landing page shows once; after "Get started" this device goes straight to the chooser.
      if (localStorage.getItem("alienx.started")) setChoosing(true);
      const who = localStorage.getItem(PROFILE);
      if (who === "all" || accounts.some((a) => a.handle === who)) setProfile(who);
    } catch {
      // No storage: start on the landing page, then the chooser, then Create.
    }
    setReady(true);
    // Once, on load: the minute refresh hands over new account objects and must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (who: string | null) => {
    turn(() => {
      setProfile(who);
      // Switching profile goes back to the chooser, not to the landing page.
      if (!who) setChoosing(true);
      // A freshly chosen profile starts at the beginning: Create.
      if (who) setView("write");
    });
    try {
      if (who) {
        localStorage.setItem(PROFILE, who);
        localStorage.setItem(STORE, "write");
      }
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
    if (v === view) return;
    turn(() => setView(v));
    try {
      localStorage.setItem(STORE, v);
    } catch {
      // Nothing to remember it in.
    }
  };

  // The corner switch, the same place on every screen.
  const themeSwitch = (
    <button
      type="button"
      data-press
      onClick={flipTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      style={{ viewTransitionName: "theme" }}
      className="btn btn-ground fixed top-2 right-2 z-30 size-11 rounded-full p-0 sm:top-3 sm:right-3 lg:top-5 lg:right-8"
    >
      <ThemeIcon theme={theme} className="size-5" />
    </button>
  );

  // Until the device's choice is read, show nothing rather than flash the wrong screen.
  if (!ready) return <div className="h-dvh" />;
  if (!profile)
    return (
      <div className="h-dvh overflow-hidden">
        <h1 className="sr-only">alienX</h1>
        {choosing ? (
          <Profiles accounts={ordered} posts={posts} onPick={pick} />
        ) : (
          <Landing
            onStart={() => {
              try {
                localStorage.setItem("alienx.started", "1");
              } catch {
                // Shown again next time; harmless.
              }
              turn(() => setChoosing(true));
            }}
          />
        )}
        {themeSwitch}
      </div>
    );

  // Inside a profile everything is that account only; "all" is the combined view.
  const mine = profile === "all" ? ordered : ordered.filter((a) => a.handle === profile);
  const own = (h: string) => profile === "all" || h === profile;
  const myPosts = posts.filter((p) => own(p.handle));
  const myTopics = topics.filter((t) => own(t.handle));
  const me = mine.length === 1 ? mine[0]! : null;
  const due = myPosts.filter((p) => p.status === "due").length;
  const badges: Record<View, number> = { week: due, write: myTopics.length };

  return (
    <div className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">alienX{me ? `, ${me.name}` : ", all accounts"}</h1>
      {/* Keyed by profile, so switching starts each view fresh for that account. */}
      <div hidden={view !== "week"} className="view h-full">
        <Week key={profile} accounts={mine} posts={myPosts} sources={sources} now={now} />
      </div>
      <div hidden={view !== "write"} className="view h-full">
        <Studio key={profile} accounts={mine} topics={myTopics} onOpenStudio={() => go("week")} />
      </div>
      <nav aria-label="Views">
        <Dock
          style={{ viewTransitionName: "dock" }}
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
              label: `${me ? me.name : "All accounts"}: switch profile`,
              onClick: () => pick(null),
            },
          ]}
        />
      </nav>
      {themeSwitch}
    </div>
  );
}
