import { listAccounts } from "../lib/accounts.ts";
import { ordered, readLocal } from "../lib/local.ts";
import { rules } from "../lib/schedule.ts";
import { readCorpus } from "../lib/corpus.ts";
import { type Finding, getTopic, listPosts, listTopics } from "../lib/db.ts";
import { decisions } from "../lib/plan.ts";
import { taste } from "../lib/taste.ts";
import { addDays, at, local, ZONE } from "../lib/time.ts";
import { Shell } from "./shell.tsx";

// Accounts are files that change while the app runs, so read them on every request.
export const dynamic = "force-dynamic";

export default function Page() {
  const all = listAccounts();
  const own = readLocal();
  const accounts = ordered(all, own.order).map((a) => {
    const profile = a.profile ?? all.find((p) => p.handle === a.inherits)?.profile;
    return {
      handle: a.handle,
      name: a.display_name,
      type: a.type,
      figure: own.figures && Object.hasOwn(own.figures, a.handle) ? String(own.figures[a.handle]) : null,
      inherits: a.inherits ?? null,
      pillars: a.pillars ?? [],
      ready: Boolean(profile),
      emoji: profile?.uses_emoji ?? false,
      banned: a.banned_words ?? [],
      articles: readCorpus(a.handle).length,
      samples: a.x_samples.length,
      cadence: (({ per_week, per_day, gap_min, weekday, weekend }) => ({ per_week, per_day, gap_min, weekday, weekend }))(rules(a.handle)),
    };
  });
  // Posts from two weeks back (so last Monday-to-Sunday week is whole) to three weeks ahead,
  // so the Studio can page between weeks and its stats count every post. Keep in step with
  // BACK in app/week.tsx.
  const now = new Date();
  const today = local(now, ZONE).day;
  const posts = listPosts(at(addDays(today, -14), 0, ZONE).toISOString(), at(addDays(today, 21), 0, ZONE).toISOString());
  // The sources behind each researched post, from the topic it was drafted from.
  const sources: Record<number, Finding[]> = {};
  for (const p of posts) if (p.topic_id) sources[p.id] = getTopic(p.topic_id).findings;
  // What each account drafts and skips, so Create puts the best-fitting idea on top.
  // Only the person's own decisions count: alienX's picks they never approved are left out.
  const history = decisions();
  const tastes = Object.fromEntries(accounts.map((a) => [a.handle, taste(history, a.handle)]));
  return <Shell accounts={accounts} posts={posts} topics={listTopics("proposed")} tastes={tastes} sources={sources} now={now.toISOString()} />;
}
