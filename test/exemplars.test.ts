import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { listAccounts } from "../lib/accounts.ts";
import { readCorpus } from "../lib/corpus.ts";
import { locate } from "../lib/profile.ts";

// The voices and corpus are private and not in the public repo; these checks run where they exist.
const privateData = fs.existsSync(path.join(process.cwd(), "voices", "dibakaarr.json")) ? false : "needs the private voices/ and corpus/ folders";

test("every exemplar is verbatim in the corpus article at its url", { skip: privateData }, () => {
  let checked = 0;
  for (const account of listAccounts()) {
    const corpus = readCorpus(account.handle);
    for (const e of account.profile?.exemplars ?? []) {
      const article = corpus.find((a) => a.url === e.url);
      assert.ok(article, `@${account.handle}: no corpus article for ${e.url}`);
      assert.ok(article.body.includes(e.text), `@${account.handle}: not verbatim in ${e.url}: ${e.text}`);
      checked++;
    }
  }
  assert.ok(checked > 0, "no exemplars found to check");
});

test("locate returns the corpus's own characters and rejects what is not there", () => {
  const article = { title: "t", url: "u", date: "2026-01-01", body: "I said “wait” and it’s fine.\n\n> A quoted line." };
  assert.equal(locate('I said "wait" and it\'s fine.', article), "I said “wait” and it’s fine.");
  assert.equal(locate("I said wait and it is fine.", article), null);
  assert.equal(locate("A quoted line.", article), null);
  assert.equal(locate("anything", undefined), null);
});
