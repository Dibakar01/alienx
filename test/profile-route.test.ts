import assert from "node:assert/strict";
import test from "node:test";

process.env.ALIENX_DB = ":memory:";
const { POST } = await import("../app/api/profile/route.ts");

const ask = (body: unknown, origin = "http://127.0.0.1:3000") =>
  POST(new Request("http://127.0.0.1:3000/api/profile", { method: "POST", headers: { host: "127.0.0.1:3000", origin, "content-type": "application/json" }, body: JSON.stringify(body) }));

test("only alienX's own page may start learning a voice", async () => {
  assert.equal((await ask({ handle: "sam_writes" }, "https://evil.example")).status, 403);
});

test("a handle that is not an X handle is refused before anything runs", async () => {
  assert.deepEqual(await (await ask({ handle: "../voices/x" })).json(), { error: "Which account?" });
});

test("an account that does not exist comes back as an error, to every ask that joined", async () => {
  const [a, b] = await Promise.all([ask({ handle: "no_such_acct_x" }), ask({ handle: "no_such_acct_x" })]);
  for (const r of [await a.json(), await b.json()]) assert.ok((r as { error?: string }).error);
});
