// npm run plan                          discover ideas, then draft and schedule every one (skips Approve)
// npm run plan -- --only yourhandle      one account
// npm run plan -- --research-only       ideas only; draft and approve them in Create
// npm run plan -- --daily               alienX's pick: one approved post for each account with nothing coming
// launchd runs --research-only every Sunday at 20:00 (app.alienx.plan), so nothing
// reaches the Studio calendar without a founder's approval.
import path from "node:path";
import { backup } from "../lib/db.ts";
import { daily, plan } from "../lib/plan.ts";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
if (args.includes("--daily")) {
  // The day's copy of the database first; a failed backup never stops the pick.
  try {
    await backup(path.join(process.cwd(), "data", "backups"));
  } catch (e) {
    console.error(`no backup today (${e instanceof Error ? e.message : e})`);
  }
}
const failed = args.includes("--daily") ? await daily(only) : await plan({ only, researchOnly: args.includes("--research-only") });
process.exitCode = failed ? 1 : 0;
