// npm run profile            every account that has a corpus or x_samples
// npm run profile -- handle  one account
import { listAccounts } from "../lib/accounts.ts";
import { readCorpus } from "../lib/corpus.ts";
import { buildProfile } from "../lib/profile.ts";

const only = process.argv[2];
const handles = only
  ? [only]
  : listAccounts().filter((a) => readCorpus(a.handle).length || a.x_samples.length).map((a) => a.handle);

for (const handle of handles) {
  console.log(`@${handle}: studying the human`);
  const account = await buildProfile(handle);
  console.log(`@${handle}: profile written, ${account.profile!.exemplars.length} verbatim exemplars`);
}
