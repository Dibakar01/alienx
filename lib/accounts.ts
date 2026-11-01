import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// An X handle. Also what keeps a handle safe to use as a file and folder name.
export const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

// What each field should hold is explained to the model in prompts/profile.md.
export const Profile = z.object({
  identity: z.string(),
  themes: z.array(z.string()),
  stance: z.object({ believes: z.array(z.string()), pushes_against: z.array(z.string()) }),
  diction: z.object({ uses: z.array(z.string()), never_uses: z.array(z.string()) }),
  rhythm: z.string(),
  uses_emoji: z.boolean(),
  humour: z.string(),
  openings: z.array(z.string()),
  closings: z.array(z.string()),
  do_not: z.array(z.string()),
  x_translation: z.object({ survives: z.array(z.string()), cut: z.array(z.string()) }),
  exemplars: z.array(z.object({ text: z.string(), url: z.string() })),
});
export type Profile = z.infer<typeof Profile>;

// Tags typed by a person (topics, writing style) go into prompts, so each is cleaned at the
// door: no control characters or brackets that could close a prompt block, one space between
// words, at most 32 characters, no repeats (any case), and at most `max` of them.
export function tags(input: string | string[], max: number): string[] {
  const out: string[] = [];
  for (const raw of Array.isArray(input) ? input : input.split(",")) {
    const t = raw.replace(/[\u0000-\u001f\u007f<>{}\[\]`]/g, "").replace(/\s+/g, " ").trim().slice(0, 32).trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, max);
}

export const Account = z.object({
  handle: z.string().regex(HANDLE, "Not a valid X handle."),
  display_name: z.string().min(1, "A display name is needed."),
  type: z.enum(["personal", "brand"], "Type must be personal or brand."),
  // What this account posts about. A draft's pillar must be one of these.
  pillars: z.array(z.string().trim().min(1)).optional(),
  inherits: z.string().regex(HANDLE, "Not a valid X handle.").optional(),
  // A web address only: ingest fetches it, so no file: or other schemes.
  source_url: z.url({ protocol: /^https?$/, error: "Not a valid URL." }).optional(),
  // Posts from the source that must never enter the corpus.
  exclude_urls: z.array(z.string()).optional(),
  // How the person wants to sound, picked as tags; the voice is built from these when there is no writing to study.
  style: z.array(z.string().trim().min(1)).optional(),
  // Words a draft for this account may not contain, such as "I" for an account that speaks as "we".
  banned_words: z.array(z.string()).optional(),
  x_samples: z.array(z.string()).default([]),
  profile: Profile.optional(),
  brand_layer: z.record(z.string(), z.unknown()).optional(),
});
export type Account = z.infer<typeof Account>;

const dir = path.join(process.cwd(), "voices");
const file = (handle: string) => {
  if (!HANDLE.test(handle)) throw new Error(`Not a valid handle: ${handle}`);
  return path.join(dir, `${handle}.json`);
};

export function readAccount(handle: string): Account {
  return Account.parse(JSON.parse(fs.readFileSync(file(handle), "utf8")));
}

// A file that does not parse is left out and logged, so one bad hand edit cannot take the
// whole app down.
export function listAccounts(): Account[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => {
      try {
        return [readAccount(f.slice(0, -".json".length))];
      } catch (e) {
        console.error(`voices/${f} skipped: ${e instanceof Error ? e.message : e}`);
        return [];
      }
    });
}

export function writeAccount(account: Account): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(account.handle), JSON.stringify(Account.parse(account), null, 2) + "\n");
}
