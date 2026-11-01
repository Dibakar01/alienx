import fs from "node:fs";
import path from "node:path";

// The few things that differ between Mac and Windows: where the browser is, how the
// Claude CLI is started, and how a notification is shown. Every check can be injected,
// so the tests run the Windows paths on a Mac.

// env is a plain record, not ProcessEnv, which Next types with a required NODE_ENV.
type Opts = { platform?: NodeJS.Platform; env?: Record<string, string | undefined>; exists?: (p: string) => boolean };

// Chrome, or on Windows Edge (Chromium, on every Windows). CHROME_BIN always wins.
export function chromePath({ platform = process.platform, env = process.env, exists = fs.existsSync }: Opts = {}): string | null {
  if (env.CHROME_BIN) return env.CHROME_BIN;
  let tries: string[] = [];
  if (platform === "darwin") tries = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  if (platform === "win32") {
    const chrome = [env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA];
    const edge = [env["ProgramFiles(x86)"], env.ProgramFiles];
    tries = [
      ...chrome.filter(Boolean).map((d) => path.win32.join(d!, "Google", "Chrome", "Application", "chrome.exe")),
      ...edge.filter(Boolean).map((d) => path.win32.join(d!, "Microsoft", "Edge", "Application", "msedge.exe")),
    ];
  }
  return tries.find((p) => exists(p)) ?? null;
}

// Width and height from a PNG's IHDR chunk, or null if the bytes are not a PNG.
export function pngSize(buf: Buffer): { width: number; height: number } | null {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig) || buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// The program and leading arguments that start the Claude CLI. On Windows npm installs it
// as claude.cmd, which Node cannot start without a shell, so the .cmd is read for the
// cli.js it runs and that is started with this Node instead.
export function claudeCommand({
  platform = process.platform,
  env = process.env,
  exists = fs.existsSync,
  read = (p: string) => fs.readFileSync(p, "utf8"),
}: Opts & { read?: (p: string) => string } = {}): { cmd: string; pre: string[] } {
  if (env.CLAUDE_BIN) return { cmd: env.CLAUDE_BIN, pre: [] };
  if (platform !== "win32") return { cmd: "claude", pre: [] };
  const dirs = (env.Path ?? env.PATH ?? "").split(";").filter(Boolean);
  const exe = dirs.map((d) => path.win32.join(d, "claude.exe")).find((p) => exists(p));
  if (exe) return { cmd: exe, pre: [] };
  for (const shim of dirs.map((d) => path.win32.join(d, "claude.cmd")).filter((p) => exists(p))) {
    // npm's shim runs the package's bin: a native claude.exe in current releases
    // ("%dp0%\node_modules\@anthropic-ai\claude-code\bin\claude.exe" %*), a cli.js in older ones.
    // The shim also names "%dp0%\node.exe" (the node it may run), so a script wins and node is never picked.
    const found = [...read(shim).matchAll(/"%dp0%\\([^"]+\.(?:[cm]?js|exe))"/gi)].map((m) => m[1]!);
    const bin = found.find((f) => /\.[cm]?js$/i.test(f)) ?? found.find((f) => !/(^|\\)node\.exe$/i.test(f));
    if (bin) {
      const p = path.win32.join(path.win32.dirname(shim), bin);
      return /\.exe$/i.test(p) ? { cmd: p, pre: [] } : { cmd: process.execPath, pre: [p] };
    }
  }
  return { cmd: "claude", pre: [] };
}

// A desktop notification: Notification Center on a Mac, a toast on Windows, nothing elsewhere.
export function notifyCommand(message: string, platform: NodeJS.Platform = process.platform): { cmd: string; args: string[] } | null {
  // JSON string quoting is also valid AppleScript string quoting.
  if (platform === "darwin") return { cmd: "osascript", args: ["-e", `display notification ${JSON.stringify(message)} with title "alienX" sound name "Glass"`] };
  if (platform !== "win32") return null;
  // A PowerShell single-quoted string: each quote is doubled, curly ones too, since
  // PowerShell reads those as quotes as well.
  const text = `'${message.replace(/['‘’‚‛]/g, "$&$&")}'`;
  const n = "[Windows.UI.Notifications.ToastNotificationManager]";
  const script = [
    `${n.slice(0, -1)}, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null`,
    `$x = ${n}::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)`,
    `$t = $x.GetElementsByTagName('text')`,
    `$t.Item(0).AppendChild($x.CreateTextNode('alienX')) > $null`,
    `$t.Item(1).AppendChild($x.CreateTextNode(${text})) > $null`,
    // Windows only shows toasts from a registered app id, so it borrows PowerShell's own.
    `${n}::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))`,
  ].join("; ");
  return { cmd: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", script] };
}
