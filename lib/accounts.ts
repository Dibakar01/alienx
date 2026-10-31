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

export const Account = z.object({
  handle: z.string().regex(HANDLE, "Not a valid X handle."),
  display_name: z.string().min(1, "A display name is needed."),
  type: z.enum(["personal", "brand"], "Type must be personal or brand."),
  // What this account posts about. A draft's pillar must be one of these.
  pillars: z.array(z.string().trim().min(1)).optional(),
  inherits: z.string().regex(HANDLE, "Not a valid X handle.").optional(),
  source_url: z.url("Not a valid URL.").optional(),
  // Posts from the source that must never enter the corpus.
  exclude_urls: z.array(z.string()).optional(),
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

export function listAccounts(): Account[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readAccount(f.slice(0, -".json".length)));
}

export function writeAccount(account: Account): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(account.handle), JSON.stringify(Account.parse(account), null, 2) + "\n");
}
