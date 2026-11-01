// node scripts/make-ico.ts: draws brand/alienx.ico, the Windows shortcut icon, from the
// same alien mark scripts/make-app.sh uses. Headless Chrome (or Edge) renders it at
// 256x256 and the PNG goes inside an ICO file as is. Run it again only if the mark changes.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromePath, pngSize } from "../lib/platform.ts";

const chrome = chromePath();
if (!chrome) throw new Error("No Chrome or Edge found; set CHROME_BIN.");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alienx-ico-"));
const html = path.join(tmp, "icon.html"), png = path.join(tmp, "icon.png");
fs.writeFileSync(html, `<html><body style="margin:0;background:transparent"><svg width="256" height="256" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
<rect x="80" y="80" width="864" height="864" rx="200" fill="#D92819"/>
<g transform="translate(212 212) scale(25)"><mask id="m"><path d="M12 2C17.6 2 21 5.4 21 10C21 15.6 16.4 22 12 22C7.6 22 3 15.6 3 10C3 5.4 6.4 2 12 2Z" fill="white"/><path d="M5.2 9Q9.95 9.12 10.8 13.8Q6.05 13.68 5.2 9Z"/><path d="M18.8 9Q14.05 9.12 13.2 13.8Q17.95 13.68 18.8 9Z"/></mask><rect width="24" height="24" fill="#FBFAF8" mask="url(#m)"/></g>
</svg></body></html>`);
try {
  execFileSync(chrome, [
    "--headless", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000",
    "--screen-info={256x256}", "--window-size=256,256", "--use-mock-keychain",
    `--user-data-dir=${path.join(tmp, "profile")}`, `--screenshot=${png}`, pathToFileURL(html).href,
  ], { stdio: "ignore", timeout: 60_000 });
  const data = fs.readFileSync(png);
  const size = pngSize(data);
  if (size?.width !== 256 || size.height !== 256) throw new Error(`Chrome drew ${size?.width}x${size?.height}, expected 256x256.`);

  // ICONDIR (reserved 0, type 1 = icon, 1 image), then one 16-byte ICONDIRENTRY:
  // width and height 0 mean 256, no palette, 1 plane, 32 bits, payload size, payload offset.
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  head.writeUInt16LE(1, 10);
  head.writeUInt16LE(32, 12);
  head.writeUInt32LE(data.length, 14);
  head.writeUInt32LE(head.length, 18);
  const out = path.join(import.meta.dirname, "..", "brand", "alienx.ico");
  fs.writeFileSync(out, Buffer.concat([head, data]));
  console.log(`Wrote ${out}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
