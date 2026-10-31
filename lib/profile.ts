import { type Account, Profile, readAccount, writeAccount } from "./accounts.ts";
import { type Article, readCorpus } from "./corpus.ts";
import { ask, prompt } from "./llm.ts";

const EXEMPLARS = 10;

// Character-for-character folding of quote styles, so an index into the folded text
// is also an index into the original.
const fold = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, " ");

// The exact corpus substring for an exemplar, or null when it is not in the article
// or sits on a quoted line (which may be someone else's words).
export function locate(text: string, article: Article | undefined): string | null {
  const wanted = text.trim();
  if (!article || !wanted) return null;
  const at = fold(article.body).indexOf(fold(wanted));
  if (at < 0) return null;
  const lineStart = article.body.lastIndexOf("\n", at) + 1;
  if (article.body.startsWith("> ", lineStart)) return null;
  return article.body.slice(at, at + wanted.length);
}

// Builds voices/{handle}.json from that account's corpus and x_samples only.
export async function buildProfile(handle: string): Promise<Account> {
  const account = readAccount(handle);
  const corpus = readCorpus(handle);
  if (!corpus.length && !account.x_samples.length) throw new Error(`@${handle}: no corpus and no x_samples to study`);

  const { system, user } = prompt("profile", {
    display_name: account.display_name,
    handle,
    corpus: corpus.map((a) => `<article url="${a.url}" title=${JSON.stringify(a.title)}>\n${a.body}\n</article>`).join("\n\n"),
    x_samples: account.x_samples.join("\n") || "(none provided)",
  });
  const profile = await ask(Profile, system, user);

  // Keep only what is verbatim in the corpus, stored as the corpus's own characters.
  const byUrl = new Map(corpus.map((a) => [a.url, a]));
  const exemplars: Profile["exemplars"] = [];
  for (const e of profile.exemplars) {
    const exact = locate(e.text, byUrl.get(e.url));
    if (exact && !exemplars.some((x) => x.text === exact)) exemplars.push({ text: exact, url: e.url });
  }
  const need = corpus.length ? EXEMPLARS : 0;
  if (exemplars.length < need) {
    throw new Error(`@${handle}: only ${exemplars.length} of ${profile.exemplars.length} exemplar candidates are verbatim in the corpus, need ${need}. Nothing was written. Run again.`);
  }

  const next = { ...account, profile: { ...profile, exemplars: exemplars.slice(0, need) } };
  writeAccount(next);
  return next;
}
