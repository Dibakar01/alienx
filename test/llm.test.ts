import assert from "node:assert/strict";
import test from "node:test";
import { guard, reply } from "../lib/llm.ts";

test("a run on the subscription returns its structured reply", () => {
  const events = [
    { type: "system", subtype: "init", apiKeySource: "none" },
    { type: "rate_limit_event", rate_limit_info: { isUsingOverage: false } },
    { type: "result", is_error: false, structured_output: { ok: true } },
  ];
  for (const e of events) guard(e);
  assert.deepEqual(reply(events), { ok: true });
});

test("a run that would be billed is refused", () => {
  assert.throws(() => guard({ type: "system", subtype: "init", apiKeySource: "ANTHROPIC_API_KEY" }), /Refused a paid call/);
  assert.throws(() => guard({ type: "system", subtype: "init" }), /Refused a paid call/);
  assert.throws(() => guard({ type: "rate_limit_event", rate_limit_info: { isUsingOverage: true } }), /usage credits/);
});

test("a failed or empty run is an error, never a made-up reply", () => {
  assert.throws(() => reply([]), /no usable reply/);
  assert.throws(() => reply([{ type: "result", is_error: true, result: "You've hit your session limit" }]), /session limit/);
  assert.throws(() => reply([{ type: "result", is_error: false, result: "plain text, no JSON" }]), /no usable reply/);
});
