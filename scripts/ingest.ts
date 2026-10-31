// npm run ingest            every account that has a source_url
// npm run ingest -- handle  one account
import { listAccounts, readAccount } from "../lib/accounts.ts";
import { ingest } from "../lib/ingest.ts";

const only = process.argv[2];
const accounts = only ? [readAccount(only)] : listAccounts().filter((a) => a.source_url);

for (const account of accounts) {
  // A failure here is fatal on purpose: no source may be skipped or made up.
  const r = await ingest(account);
  console.log(`@${r.handle}: ${r.feed + r.sitemap} articles (${r.feed} from feed, ${r.sitemap} from sitemap)`);
  for (const url of r.skipped) console.log(`  skipped, no text: ${url}`);
  for (const w of r.warnings) console.log(`  warning: ${w}`);
}
