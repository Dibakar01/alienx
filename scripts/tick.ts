// npm run tick   one pass: posts whose slot has come turn due and one notification goes out.
// launchd runs this every minute (app.alienx.tick).
import { tick } from "../lib/schedule.ts";

const due = tick();
if (due.length) console.log(`${new Date().toISOString()} due: ${due.map((p) => `#${p.id} @${p.handle}`).join(", ")}`);
