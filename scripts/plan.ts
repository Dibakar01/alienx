// npm run plan                          discover ideas, then draft and schedule every one (skips Approve)
// npm run plan -- --only dibakaarr      one account
// npm run plan -- --research-only       ideas only; draft and approve them in Create
// npm run plan -- --daily               alienX's pick: one approved post for each account with nothing coming
// launchd runs --research-only every Sunday at 20:00 (com.qalakaar.alienx.plan), so nothing
// reaches the Studio calendar without a founder's approval.
import { daily, plan } from "../lib/plan.ts";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const failed = args.includes("--daily") ? await daily(only) : await plan({ only, researchOnly: args.includes("--research-only") });
process.exitCode = failed ? 1 : 0;
