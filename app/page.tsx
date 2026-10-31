import { listAccounts } from "../lib/accounts.ts";
import { readCorpus } from "../lib/corpus.ts";
import { type Finding, getTopic, listPosts, listTopics } from "../lib/db.ts";
import { addDays, at, local, ZONE } from "../lib/time.ts";
import { Shell } from "./shell.tsx";

// Accounts are files that change while the app runs, so read them on every request.
export const dynamic = "force-dynamic";

export default function Page() {
  const all = listAccounts();
  const accounts = all.map((a) => {
    const profile = a.profile ?? all.find((p) => p.handle === a.inherits)?.profile;
    return {
      handle: a.handle,
      name: a.display_name,
      type: a.type,
      inherits: a.inherits ?? null,
      pillars: a.pillars ?? [],
      ready: Boolean(profile),
      emoji: profile?.uses_emoji ?? false,
      banned: a.banned_words ?? [],
      articles: readCorpus(a.handle).length,
      samples: a.x_samples.length,
    };
  });
  // Posts from a week back to three weeks ahead, so the Studio can page between weeks.
  const now = new Date();
  const today = local(now, ZONE).day;
  const posts = listPosts(at(addDays(today, -7), 0, ZONE).toISOString(), at(addDays(today, 21), 0, ZONE).toISOString());
  // The sources behind each researched post, from the topic it was drafted from.
  const sources: Record<number, Finding[]> = {};
  for (const p of posts) if (p.topic_id) sources[p.id] = getTopic(p.topic_id).findings;
  return <Shell accounts={accounts} posts={posts} topics={listTopics("proposed")} sources={sources} now={now.toISOString()} />;
}
