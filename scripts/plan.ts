// npm run plan                          research, draft and schedule the week for every account
// npm run plan -- --only dibakaarr      one account
// npm run plan -- --research-only       topics only; draft them from the Studio
// launchd runs the full form every Sunday at 20:00 (com.qalakaar.alienx.plan).
import { plan } from "../lib/plan.ts";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const failed = await plan({ only, researchOnly: args.includes("--research-only") });
process.exitCode = failed ? 1 : 0;
