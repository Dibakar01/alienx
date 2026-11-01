// npm run setup|open|stop|app|local: runs the bash script on a Mac and its PowerShell
// twin on Windows, so the same npm commands work on both. Plain JavaScript, so it runs on any
// Node and setup can still say "Node 24 or newer" to someone on an older one.
import { spawnSync } from "node:child_process";
import path from "node:path";

const name = process.argv[2];
const win = { setup: "setup", open: "open", stop: "stop", app: "make-shortcut", local: "open" }[name];
const mac = { setup: "setup", open: "open", stop: "stop", app: "make-app", local: "local" }[name];
if (!win || !mac) { console.error(`Unknown script: ${name}`); process.exit(1); }

const dir = import.meta.dirname;
const r = process.platform === "win32"
  ? spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(dir, `${win}.ps1`), ...process.argv.slice(3)], { stdio: "inherit" })
  : spawnSync("bash", [path.join(dir, `${mac}.sh`), ...process.argv.slice(3)], { stdio: "inherit" });
if (r.error) console.error(r.error.message);
process.exit(r.status ?? 1);
