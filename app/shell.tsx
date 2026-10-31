"use client";

// The whole site, in the order it is used: the landing page (first visit), who is posting,
// then two views switched by the dock: Create (ideas to an approved post) and Studio (the
// calendar of approved posts, to post from). Nothing scrolls; views stay mounted, so drafts
// in progress survive a switch.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Finding, Post, Topic } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import { Activity, startJob } from "./activity.tsx";
import { Avatar } from "./avatar.tsx";
import Dock from "./bits/Dock.tsx";
import { Mascot } from "./mascot.tsx";
import { Profiles } from "./profiles.tsx";
import { ThemeIcon, useTheme } from "./theme.tsx";
import { Landing } from "./landing.tsx";
import { type Face, Studio } from "./studio.tsx";
import { Week } from "./week.tsx";

// In the order the work happens: make a post, then schedule and post it.
type View = "write" | "week";
const VIEWS: View[] = ["write", "week"];
const STORE = "alienx.view";
const PROFILE = "alienx.profile";
// The order the profiles stand in: the brand first, then the founders.
const ORDER = ["iamqalakaar", "dibakaarr", "anshsarkar_"];

// Each step's mark on the dock: its number at the top left, then its picture, so the order
// reads at a glance and the dock keeps its magnifying motion.
const mark = (n: number, d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <text x="0" y="8.5" fill="currentColor" stroke="none" fontSize="9.5" fontWeight="800" fontFamily="var(--font-mono, ui-monospace)">
      {n}
    </text>
    <path d={d} />
  </svg>
);
// The steps, in the order the work happens. Steps 1 and 2 are the two halves of Create.
const STEPS = [
  // A bulb; a stamp; a calendar page.
  { n: 1, label: "Idea", where: "idea", icon: mark(1, "M14.5 21h3M13.6 18.5h5.8M16.5 6a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z") },
  { n: 2, label: "Approve", where: "drafts", icon: mark(2, "M10 21h12M11 18h10v-2.5a1.5 1.5 0 0 0-1.5-1.5h-2.2l-.6-3.2a2.4 2.4 0 1 0-1.4 0l-.6 3.2h-2.2a1.5 1.5 0 0 0-1.5 1.5z") },
  { n: 3, label: "Studio", where: "week", icon: mark(3, "M9 9.5h13v11H9zM9 13h13M12.5 7.5v3M18.5 7.5v3M12 16h2M16 16h2M12 18.5h2") },
] as const;
type Where = (typeof STEPS)[number]["where"];

// A change of view or profile happens at once; the incoming page slides in with a CSS
// animation (.page-in, .view). A View Transition was used before, but it freezes the page
// for its whole length and drops clicks, which made moving around during work feel stuck.
const turn = (change: () => void) => change();

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
  // Which half of Create is in front: the idea or the drafts.
  const [face, setFace] = useState<Face>("thought");
  // A first visit opens on the landing page; "Get started" moves on to choosing who is posting.
  const [choosing, setChoosing] = useState(false);
  // The landing page, opened again from the alien mark at the top left.
  const [about, setAbout] = useState(false);
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

  // alienX's pick: once a day, each account in view that has a voice and nothing coming gets
  // one approved post booked (the server checks again and keeps to the cadence). It shows in
  // the activity card and lands on the Studio calendar, tagged as alienX's pick.
  const picking = useRef(false);
  useEffect(() => {
    if (!profile || picking.current) return;
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const empty = accounts.filter(
      (a) =>
        a.ready &&
        (profile === "all" || a.handle === profile) &&
        !posts.some((p) => p.handle === a.handle && (p.status === "due" || (p.status === "scheduled" && p.scheduled_at >= nowIso))),
    );
    // Asked today already and answered: not again. A reload mid-run asks again and rejoins it.
    const stamp = (h: string) => {
      try {
        localStorage.setItem(`alienx.pick.${h}`, today);
      } catch {
        // Nowhere to remember it; the server still never books twice.
      }
    };
    const todo = empty.filter((a) => {
      try {
        return localStorage.getItem(`alienx.pick.${a.handle}`) !== today;
      } catch {
        return false; // Nowhere to remember it, so never ask on every refresh.
      }
    });
    if (!todo.length) return;
    picking.current = true;
    void (async () => {
      for (const { handle } of todo) {
        // With ideas waiting it only drafts and draws; with none it discovers some first.
        const waiting = topics.some((t) => t.handle === handle);
        const done = startJob({ handle, label: `Choosing today's pick for @${handle}`, kind: "discover", where: "week", typical: waiting ? 120 : 360 });
        const r = (await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pick: handle }) })
          .then((x) => x.json())
          .catch((e: unknown) => ({ error: String(e), left: true }))) as { post?: Post | null; error?: string; left?: boolean };
        // A request cut off by leaving the page is not an answer; the next visit rejoins the run.
        if (!r.left) stamp(handle);
        done(r.error ? { ok: false, text: `No pick for @${handle} today. Draft one in Create.` } : r.post ? { ok: true, text: `Today's pick for @${handle} is on the Studio calendar.` } : undefined);
      }
      picking.current = false;
      router.refresh();
    })();
  }, [profile, posts, accounts, topics, router]);

  // A step on the rail, or where a finished job's result landed.
  const goTo = (w: Where) => {
    if (w !== "week") setFace(w === "drafts" ? "post" : "thought");
    go(w === "week" ? "week" : "write");
  };

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
      className="btn btn-ground fixed top-2 right-2 z-30 size-11 rounded-full p-0 sm:top-3 sm:right-3 lg:top-5 lg:right-8"
    >
      <ThemeIcon theme={theme} className="size-5" />
    </button>
  );

  // Until the device's choice is read: a short opening card, never the wrong screen.
  if (!ready)
    return (
      <div className="grid h-dvh place-items-center">
        <div className="rise grid justify-items-center gap-3">
          <Mascot blink className="size-14 text-brand" />
          <p className="text-sm text-snow-muted">Opening alienX</p>
        </div>
      </div>
    );

  if (about)
    return (
      <div className="h-dvh overflow-hidden">
        <div className="page-in h-full">
          <Landing onStart={() => turn(() => setAbout(false))} cta="Back to alienX" />
        </div>
        {themeSwitch}
      </div>
    );
  if (!profile)
    return (
      <div className="h-dvh overflow-hidden">
        <h1 className="sr-only">alienX</h1>
        {choosing ? (
          <div className="page-in h-full">
          <Profiles accounts={ordered} posts={posts} onPick={pick} onAbout={() => turn(() => setAbout(true))} />
          </div>
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
        <Activity />
      </div>
    );

  // Inside a profile everything is that account only; "all" is the combined view.
  const mine = profile === "all" ? ordered : ordered.filter((a) => a.handle === profile);
  const own = (h: string) => profile === "all" || h === profile;
  const myPosts = posts.filter((p) => own(p.handle));
  const myTopics = topics.filter((t) => own(t.handle));
  const me = mine.length === 1 ? mine[0]! : null;
  const due = myPosts.filter((p) => p.status === "due").length;
  const badges: Record<Where, number> = { idea: myTopics.length, drafts: 0, week: due };
  const at: Where = view === "week" ? "week" : face === "post" ? "drafts" : "idea";

  return (
    <div className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">alienX{me ? `, ${me.name}` : ", all accounts"}</h1>
      {/* Keyed by profile, so switching starts each view fresh for that account. */}
      <div hidden={view !== "week"} className="view h-full">
        <Week key={profile} accounts={mine} posts={myPosts} sources={sources} now={now} onAbout={() => turn(() => setAbout(true))} onStart={() => goTo("idea")} />
      </div>
      <div hidden={view !== "write"} className="view h-full">
        <Studio key={profile} accounts={mine} topics={myTopics} face={face} setFace={setFace} onOpenStudio={() => go("week")} onAbout={() => turn(() => setAbout(true))} />
      </div>
      <nav aria-label="Steps">
        <Dock
          baseItemSize={46}
          magnification={62}
          panelHeight={62}
          items={[
            ...STEPS.map((s) => ({
              icon: s.icon,
              label: `${s.n} ${s.label}`,
              active: at === s.where,
              badge: badges[s.where] ? String(badges[s.where]) : undefined,
              onClick: () => goTo(s.where),
            })),
            { separator: true },
            {
              // Who is posting; pressing it goes back to the dial.
              icon: me ? <Avatar who={me} size={34} /> : <span className="text-[0.5em] font-bold">All</span>,
              label: `${me ? me.name : "All accounts"}: switch profile`,
              onClick: () => pick(null),
            },
          ]}
        />
      </nav>
      {themeSwitch}
      <Activity onGo={goTo} only={profile} />
    </div>
  );
}

