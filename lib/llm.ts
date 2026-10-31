import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

// Loads prompts/{name}.md and fills its {{slots}}. The file holds the system prompt,
// a line of five equals signs, then the user message. Prompt text lives there, never here.
export function prompt(name: string, vars: Record<string, string>): { system: string; user: string } {
  const template = fs.readFileSync(path.join(process.cwd(), "prompts", `${name}.md`), "utf8");
  const [system, user] = template.split("\n=====\n").map((part) =>
    part
      .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        if (!(key in vars)) throw new Error(`prompts/${name}.md needs {{${key}}}`);
        return vars[key]!;
      })
      .trim(),
  );
  if (!system || !user) throw new Error(`prompts/${name}.md needs a ===== line between its system and user parts`);
  return { system, user };
}

// alienX must cost nothing to run. Model calls go through the Claude Code CLI on the
// Claude subscription, and these variables are withheld from it because any of them
// would move a call onto a paid account.
const PAID = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
];

// One line of Claude Code's stream-json output. Only the fields read here.
type Event = {
  type?: string;
  subtype?: string;
  apiKeySource?: string;
  rate_limit_info?: { isUsingOverage?: boolean };
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
};

// Throws when an event shows the run is not on the subscription. A missing
// apiKeySource is refused too: unknown means not proven free.
export function guard(e: Event): void {
  if (e.type === "system" && e.subtype === "init" && e.apiKeySource !== "none") {
    throw new Error(`Refused a paid call: Claude Code is signed in with "${e.apiKeySource}", not the Claude subscription.`);
  }
  if (e.type === "rate_limit_event" && e.rate_limit_info?.isUsingOverage) {
    throw new Error("Refused: this call drew on paid usage credits.");
  }
}

// The structured reply from a finished run. A refusal, a plan limit or a cut-off run is an error.
export function reply(events: Event[]): unknown {
  const result = events.findLast((e) => e.type === "result");
  if (!result || result.is_error || result.structured_output == null) {
    throw new Error(`Claude Code gave no usable reply: ${result?.result || result?.subtype || "no result"}`);
  }
  return result.structured_output;
}

// One clean model call, one reply validated against a zod schema. No MCP servers, no
// skills and none of the user's own Claude Code settings are loaded. Tools are off unless
// a caller names them (research names WebSearch and WebFetch); named tools are also
// pre-approved, since -p has no one to answer a permission prompt.
// ponytail: depends on `claude -p` reading the subscription login. If a later CLI makes
// bare mode the default for -p, this fails with a sign-in error and needs the opt-out flag.
export async function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
  opts: { tools?: string[]; timeoutMs?: number } = {},
): Promise<z.infer<T>> {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) throw new Error("ANTHROPIC_MODEL is not set. Copy .env.example to .env.");
  const env = { ...process.env };
  for (const name of PAID) delete env[name];
  // Started from inside a Claude Code session (its terminal, or a server it launched), the
  // child would inherit that session's own wiring and fail to refresh the login. It gets
  // a plain environment instead, like launchd or a normal terminal gives it.
  for (const name of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_AGENT_SDK)/.test(name)) delete env[name];
  // Claude Code's validator rejects the "$schema" dialect line that zod adds.
  const shape: Record<string, unknown> = z.toJSONSchema(schema);
  delete shape.$schema;
  const tools = (opts.tools ?? []).join(",");

  // The program name comes from the environment, so the bundler is told not to trace it.
  const child = spawn(
    /*turbopackIgnore: true*/ process.env.CLAUDE_BIN ?? "claude",
    [
      "-p",
      "--model", model,
      "--effort", "high",
      "--system-prompt", system,
      "--tools", tools,
      ...(tools ? ["--allowedTools", tools] : []),
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--setting-sources", "",
      "--no-session-persistence",
      "--output-format", "stream-json",
      "--verbose",
      "--json-schema", JSON.stringify(shape),
    ],
    { cwd: os.tmpdir(), env, timeout: opts.timeoutMs ?? 600_000 },
  );
  child.stdin.end(user);

  const events: Event[] = [];
  let refused: Error | undefined;
  let pending = "";
  let stderr = "";
  const take = (line: string) => {
    let event: Event;
    try {
      event = JSON.parse(line) as Event;
    } catch {
      return; // not a JSON line
    }
    events.push(event);
    try {
      guard(event);
    } catch (error) {
      // The init event arrives before any request is sent, so a wrong login is stopped before
      // it spends anything. An overage flag can only arrive after a request, so a run with
      // tools (several requests) is stopped at the first one that drew on credits.
      refused ??= error as Error;
      child.kill();
    }
  };
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    const lines = (pending + chunk).split("\n");
    pending = lines.pop()!;
    lines.forEach(take);
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (e) => reject(new Error(`Could not start Claude Code (${e.message}). Install it and sign in, or set CLAUDE_BIN.`)));
    child.on("close", resolve);
  });
  take(pending);
  if (refused) throw refused;
  if (!events.some((e) => e.type === "result")) throw new Error(`Claude Code exited with ${code}: ${stderr.trim() || "no output"}`);
  return schema.parse(reply(events));
}
