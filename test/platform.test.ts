import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { chromePath, claudeCommand, notifyCommand, pngSize } from "../lib/platform.ts";

// A real 3x2 PNG: signature, IHDR, one IDAT, IEND. CRCs are zeros; pngSize does not read them.
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
  const rows = Buffer.alloc((width + 1) * height);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("pngSize reads the IHDR and refuses anything else", () => {
  assert.deepEqual(pngSize(png(3, 2)), { width: 3, height: 2 });
  assert.deepEqual(pngSize(png(1600, 900)), { width: 1600, height: 900 });
  assert.equal(pngSize(Buffer.from("<svg></svg>")), null);
  assert.equal(pngSize(png(3, 2).subarray(0, 20)), null);
  assert.equal(pngSize(Buffer.alloc(0)), null);
});

const winEnv = {
  ProgramFiles: "C:\\Program Files",
  "ProgramFiles(x86)": "C:\\Program Files (x86)",
  LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local",
};
const only = (...paths: string[]) => (p: string) => paths.includes(p);

test("chromePath picks per platform, CHROME_BIN first, Edge last on Windows", () => {
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  assert.equal(chromePath({ platform: "darwin", env: {}, exists: only(mac) }), mac);
  assert.equal(chromePath({ platform: "darwin", env: {}, exists: only() }), null);
  assert.equal(chromePath({ platform: "darwin", env: { CHROME_BIN: "/x/chrome" }, exists: only() }), "/x/chrome");

  const userChrome = "C:\\Users\\a\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe";
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  assert.equal(chromePath({ platform: "win32", env: winEnv, exists: only(edge, userChrome, chrome) }), chrome);
  assert.equal(chromePath({ platform: "win32", env: winEnv, exists: only(edge, userChrome) }), userChrome);
  assert.equal(chromePath({ platform: "win32", env: winEnv, exists: only(edge) }), edge);
  assert.equal(chromePath({ platform: "win32", env: winEnv, exists: only() }), null);
  assert.equal(chromePath({ platform: "win32", env: { ...winEnv, CHROME_BIN: "D:\\c.exe" }, exists: only() }), "D:\\c.exe");
  assert.equal(chromePath({ platform: "linux", env: {}, exists: () => true }), null);
});

// What npm writes for @anthropic-ai/claude-code (cmd-shim), CRLF line ends and all.
const shim = [
  "@ECHO off",
  "GOTO start",
  ":find_dp0",
  "SET dp0=%~dp0",
  "EXIT /b",
  ":start",
  "SETLOCAL",
  "CALL :find_dp0",
  "",
  'IF EXIST "%dp0%\\node.exe" (',
  '  SET "_prog=%dp0%\\node.exe"',
  ") ELSE (",
  '  SET "_prog=node"',
  "  SET PATHEXT=%PATHEXT:;.JS;=;%",
  ")",
  "",
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*',
  "",
].join("\r\n");

test("claudeCommand finds the real program on Windows", () => {
  const npm = "C:\\Users\\a\\AppData\\Roaming\\npm";
  const local = "C:\\Users\\a\\.local\\bin";
  const env = { Path: `C:\\Windows\\system32;${local};${npm}` };
  const read = (p: string) => (assert.equal(p, `${npm}\\claude.cmd`), shim);

  assert.deepEqual(claudeCommand({ platform: "win32", env, exists: only(`${local}\\claude.exe`, `${npm}\\claude.cmd`), read }), { cmd: `${local}\\claude.exe`, pre: [] });
  assert.deepEqual(claudeCommand({ platform: "win32", env, exists: only(`${npm}\\claude.cmd`), read }), {
    cmd: process.execPath,
    pre: [`${npm}\\node_modules\\@anthropic-ai\\claude-code\\cli.js`],
  });
  assert.deepEqual(claudeCommand({ platform: "win32", env: { PATH: npm }, exists: only(`${npm}\\claude.cmd`), read }).pre, [`${npm}\\node_modules\\@anthropic-ai\\claude-code\\cli.js`]);
  // Current releases ship a native claude.exe, so npm's shim runs that program directly.
  const exeShim = ["@ECHO off", "GOTO start", ":find_dp0", "SET dp0=%~dp0", "EXIT /b", ":start", "SETLOCAL", "CALL :find_dp0", '"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*', ""].join("\r\n");
  assert.deepEqual(claudeCommand({ platform: "win32", env, exists: only(`${npm}\\claude.cmd`), read: () => exeShim }), {
    cmd: `${npm}\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe`,
    pre: [],
  });
  assert.deepEqual(claudeCommand({ platform: "win32", env, exists: only() }), { cmd: "claude", pre: [] });
  assert.deepEqual(claudeCommand({ platform: "win32", env: { ...env, CLAUDE_BIN: "D:\\claude.exe" }, exists: () => true, read }), { cmd: "D:\\claude.exe", pre: [] });
});

test("claudeCommand elsewhere is CLAUDE_BIN or claude", () => {
  assert.deepEqual(claudeCommand({ platform: "darwin", env: {} }), { cmd: "claude", pre: [] });
  assert.deepEqual(claudeCommand({ platform: "darwin", env: { CLAUDE_BIN: "/u/claude" } }), { cmd: "/u/claude", pre: [] });
});

test("notifyCommand per platform, with the message quoted safely", () => {
  assert.deepEqual(notifyCommand('say "hi"', "darwin"), {
    cmd: "osascript",
    args: ["-e", 'display notification "say \\"hi\\"" with title "alienX" sound name "Glass"'],
  });
  assert.equal(notifyCommand("hi", "linux"), null);

  const win = notifyCommand("it's done; ’quoted’ $(rm)", "win32")!;
  assert.equal(win.cmd, "powershell.exe");
  assert.deepEqual(win.args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"]);
  const script = win.args[3]!;
  // Shown under PowerShell's registered app id, the only kind Windows displays.
  assert.match(script, /CreateToastNotifier\('\{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7\}\\WindowsPowerShell\\v1\.0\\powershell\.exe'\)/);
  assert.ok(script.includes("CreateTextNode('it''s done; ’’quoted’’ $(rm)')"), script);
  // With the doubled quotes taken out, no quote is left to end the string early.
  const literal = /CreateTextNode\('((?:[^'’]|''|’’)*)'\)\) > \$null; \[Windows/.exec(script)?.[1];
  assert.equal(literal, "it''s done; ’’quoted’’ $(rm)");
});
