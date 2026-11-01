"use client";

// The whole site, in the order it is used: the front door (what alienX does, and the dial to
// pick who is posting), then two views switched by the dock: Create (ideas to an approved post) and Studio (the
// calendar of approved posts, to post from). Nothing scrolls; views stay mounted, so drafts
// in progress survive a switch.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Finding, Post, Topic } from "../lib/db.ts";
import type { Taste } from "../lib/taste.ts";
import type { AccountInfo } from "./accounts.tsx";
import { Activity, startJob, type Where } from "./activity.tsx";
import { Avatar } from "./avatar.tsx";
import Dock from "./bits/Dock.tsx";
import { Mascot } from "./mascot.tsx";
import { Profiles } from "./profiles.tsx";
import { ThemeIcon, useTheme } from "./theme.tsx";
import { Studio } from "./studio.tsx";
import { Week } from "./week.tsx";

// In the order the work happens: make a post, then schedule and post it.
type View = "write" | "week";
const VIEWS: View[] = ["write", "week"];
const STORE = "alienx.view";
const PROFILE = "alienx.profile";

// Each step on the dock: its picture with its name under it, always visible, so the way
// through reads at a glance and the dock keeps its magnifying motion.
const mark = (label: string, d: string) => (
  <span className="grid justify-items-center gap-[3px]" aria-hidden="true">
    <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
    <span className="text-[9px] leading-none font-semibold tracking-[0.02em] whitespace-nowrap">{label}</span>
  </span>
);
// The two steps, in the order the work happens: make a post, then post it from the calendar.
const STEPS = [
  // A pencil with a spark; a calendar page.
  { n: 1, label: "Create", view: "write", icon: mark("1 Create", "M5 19l1-4L16.5 4.5a2 2 0 0 1 3 3L9 18zM14 7l3 3M5 19h6M19 14v4M17 16h4") },
  { n: 2, label: "Studio", view: "week", icon: mark("2 Studio", "M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4M8 14h2M12 14h2M16 14h0.5M8 17h2") },
] as const;

// A change of view or profile happens at once; the incoming page slides in with a CSS
// animation (.page-in, .view). A View Transition was used before, but it freezes the page
// for its whole length and drops clicks, which made moving around during work feel stuck.
const turn = (change: () => void) => change();

export function Shell({
  accounts,
  posts,
  topics,
  tastes = {},
  sources,
  now,
}: {
  accounts: AccountInfo[];
  posts: Post[];
  topics: Topic[];
  tastes?: Record<string, Taste>;
  sources: Record<number, Finding[]>;
  now: string;
}) {
  const [view, setView] = useState<View>("write");
  // An idea a Studio suggestion asked Create to draft; `at` makes each ask a new one.
  const [start, setStart] = useState<{ topicId: number; at: number } | null>(null);
  // A post Create asked the Studio to open (just approved); `at` makes each ask a new one.
  const [openPost, setOpenPost] = useState<{ id: number; at: number } | null>(null);
  // Who is posting: one handle, "all", or nobody yet (the chooser shows). Each device remembers its own.
  const [profile, setProfile] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, flipTheme] = useTheme();
  // Where jobs show their progress in place on the Create screen right now (Studio reports it).
  const [here, setHere] = useState<Where[]>([]);
  const router = useRouter();
  // Already in order: the page sorts them (config/local.json, else the brand first).
  const ordered = accounts;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE) as View | null;
      if (saved && VIEWS.includes(saved)) setView(saved);
      // alienX always opens at the front door, with the dial turned to whoever posted last.
      const who = localStorage.getItem(PROFILE);
      if (who === "all" || accounts.some((a) => a.handle === who)) setLast(who);
    } catch {
      // No storage: start at the front door, then Create.
    }
    setReady(true);
    // Once, on load: the minute refresh hands over new account objects and must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (who: string | null) => {
    turn(() => {
      setProfile(who);
      // Asks left over from the last profile must not replay on the way back in.
      setOpenPost(null);
      setStart(null);
      if (who) setLast(who);
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

  // The very first account, made at the front door, is entered straight away.
  const empty = useRef(accounts.length === 0);
  useEffect(() => {
    if (empty.current && accounts.length && !profile) pick(accounts[0]!.handle);
    empty.current = accounts.length === 0;
    // Only the account list going from none to some matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Slots come due while the page is open, so it fetches fresh data every minute.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  // alienX manages each account in view, once a day, on its own: an account with a voice and
  // nothing coming gets one approved post booked (alienX's pick; the server checks again and
  // keeps to the cadence), and an account down to fewer than two waiting ideas gets fresh ones
  // discovered. Both show in the activity card while they run. A reload mid-run asks again
  // and the server joins the run in progress.
  const managing = useRef(false);
  useEffect(() => {
    if (!profile || managing.current) return;
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const key = (h: string) => `alienx.manage.${h}`;
    const stamp = (h: string) => {
      try {
        localStorage.setItem(key(h), today);
      } catch {
        // Nowhere to remember it; the server still never books or searches twice at once.
      }
    };
    const todo = accounts.filter((a) => {
      if (!a.ready || (profile !== "all" && a.handle !== profile)) return false;
      try {
        return localStorage.getItem(key(a.handle)) !== today;
      } catch {
        return false; // Nowhere to remember it, so never ask on every refresh.
      }
    });
    if (!todo.length) return;
    managing.current = true;
    const ask = (body: object) =>
      fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then((x) => x.json())
        .catch((e: unknown) => ({ error: String(e), left: true })) as Promise<{ post?: Post | null; topics?: unknown[]; error?: string; left?: boolean }>;
    void (async () => {
      for (const { handle } of todo) {
        let waiting = topics.filter((t) => t.handle === handle).length;
        const coming = posts.some((p) => p.handle === handle && (p.status === "due" || (p.status === "scheduled" && p.scheduled_at >= nowIso)));
        let left = false;
        if (!coming) {
          // With ideas waiting it only drafts and draws; with none it discovers some first.
          const done = startJob({ handle, label: `Choosing today's pick for @${handle}`, kind: "discover", where: "week", typical: waiting ? 120 : 360 });
          const r = await ask({ pick: handle });
          left ||= Boolean(r.left);
          if (r.post) waiting = Math.max(0, waiting - 1);
          done(r.error ? { ok: false, text: `No pick for @${handle} today. Draft one in Create.` } : r.post ? { ok: true, text: `Today's pick for @${handle} is on the Studio calendar.` } : undefined);
        }
        if (waiting < 2 && !left) {
          const done = startJob({ handle, label: `Finding fresh ideas for @${handle}`, kind: "discover", where: "idea", typical: 240 });
          const r = await ask({ research: handle });
          left ||= Boolean(r.left);
          done(r.error ? { ok: false, text: `No fresh ideas for @${handle} this time.` } : { ok: true, text: `${r.topics?.length ?? "New"} fresh ideas for @${handle} are waiting in Create.` });
        }
        // A request cut off by leaving the page is not an answer; the next visit asks again.
        if (!left) stamp(handle);
      }
      managing.current = false;
      router.refresh();
    })();
  }, [profile, posts, accounts, topics, router]);

  // A step on the rail, or where a finished job's result landed.
  const goTo = (w: Where) => go(w === "week" ? "week" : "write");

  // 1 and 2 on the keyboard switch steps, when nothing is being typed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!profile || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
      if (e.key === "1") go("write");
      if (e.key === "2") go("week");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  // The front door: what alienX does, and the dial to pick who is posting.
  if (!profile)
    return (
      <div className="h-dvh overflow-hidden">
        <h1 className="sr-only">alienX</h1>
        <div className="page-in h-full">
          <Profiles accounts={ordered} posts={posts} topics={topics} now={now} last={profile ?? last} onPick={pick} />
        </div>
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
  const badges: Record<View, number> = { write: myTopics.length, week: due };

  return (
    <div className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">alienX{me ? `, ${me.name}` : ", all accounts"}</h1>
      {/* Keyed by profile, so switching starts each view fresh for that account. */}
      <div hidden={view !== "week"} className="view h-full">
        <Week
          key={profile}
          accounts={mine}
          posts={myPosts}
          topics={myTopics}
          sources={sources}
          now={now}
          onAbout={() => pick(null)}
          openPost={openPost}
          onCreate={() => go("write")}
          onDraft={(topicId) => {
            // A suggestion to draft a waiting idea: Create opens and drafts it straight away.
            setStart({ topicId, at: Date.now() });
            go("write");
          }}
        />
      </div>
      <div hidden={view !== "write"} className="view h-full">
        <Studio
          key={profile}
          accounts={mine}
          topics={myTopics}
          tastes={tastes}
          posts={myPosts}
          now={now}
          start={start}
          onOpenStudio={(id) => {
            if (id) setOpenPost({ id, at: Date.now() });
            go("week");
          }}
          onAbout={() => pick(null)}
          onHere={setHere}
        />
      </div>
      <nav aria-label="Steps">
        <Dock
          baseItemSize={46}
          magnification={62}
          panelHeight={62}
          items={[
            ...STEPS.map((s) => ({
              icon: s.icon,
              label: `${s.n} ${s.label}${s.view === "write" ? " (key 1)" : " (key 2)"}`,
              active: view === s.view,
              badge: badges[s.view] ? String(badges[s.view]) : undefined,
              onClick: () => go(s.view),
            })),
            { separator: true },
            {
              // Who is posting; pressing it goes back to the front door.
              icon: me ? <Avatar who={me} size={34} /> : <span className="text-[0.5em] font-bold">All</span>,
              label: `${me ? me.name : "All accounts"}: switch profile`,
              onClick: () => pick(null),
            },
          ]}
        />
      </nav>
      {themeSwitch}
      <Activity onGo={goTo} only={profile} here={view === "write" ? here : []} />
    </div>
  );
}

