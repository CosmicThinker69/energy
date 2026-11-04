import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const testId = randomUUID();
let db: (typeof import("../src/lib/server/db"))["db"];
let bridge: typeof import("../src/lib/server/local-data-bridge");
let route: typeof import("../src/app/api/local-data/agent/route");
const originalToken = process.env.LOCAL_DATA_AGENT_TOKEN;
before(async () => {
  process.env.LOCAL_DATA_AGENT_TOKEN = "bridge-test-" + randomUUID();
  ({ db } = await import("../src/lib/server/db"));
  bridge = await import("../src/lib/server/local-data-bridge");
  route = await import("../src/app/api/local-data/agent/route");
});
after(async () => {
  await db.query(
    "DELETE FROM portal.local_data_requests WHERE args->>'testId'=$1",
    [testId],
  );
  await db.query("DELETE FROM portal.local_data_agents WHERE id=$1", [testId]);
  await db.end();
  if (originalToken === undefined) delete process.env.LOCAL_DATA_AGENT_TOKEN;
  else process.env.LOCAL_DATA_AGENT_TOKEN = originalToken;
});

test("machine endpoint rejects unauthenticated and malformed requests before queue access", async () => {
  assert.equal(bridge.validAgentToken(null), false);
  assert.equal(bridge.validAgentToken("Bearer wrong"), false);
  const result = await route.POST(
    new Request("http://localhost/api/local-data/agent", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(result.status, 401);
  const malformed = await route.POST(
    new Request("http://localhost/api/local-data/agent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOCAL_DATA_AGENT_TOKEN}`,
      },
      body: '{"action":"execute_sql","sql":"DELETE FROM users"}',
    }),
  );
  assert.equal(malformed.status, 400);
  const nullBody = await route.POST(
    new Request("http://localhost/api/local-data/agent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOCAL_DATA_AGENT_TOKEN}`,
      },
      body: "null",
    }),
  );
  assert.equal(nullBody.status, 400);
});

test("concurrent requests share one lease, reject stale replies and cache native missing/negative values", async () => {
  await db.query(
    "INSERT INTO portal.local_data_agents(id,version) VALUES($1,'test')",
    [testId],
  );
  const args = { country: "BG", days: 1, resolution: "hourly", testId };
  const first = bridge.requestLocalData("market", args);
  const second = bridge.requestLocalData("market", args);
  let jobs: Awaited<ReturnType<typeof bridge.pollAgent>> = [];
  for (let i = 0; i < 5 && !jobs.length; i++)
    jobs = await bridge.pollAgent(testId, 1);
  const job = jobs.find((j) => j.args.testId === testId);
  assert.ok(job);
  assert.equal(
    await bridge.acceptAgentResult(job.id, randomUUID(), {}, false),
    false,
  );
  const payload = {
    rows: [{ price: -4.2, generation: null }],
    source: "entsoe",
  };
  assert.equal(
    await bridge.acceptAgentResult(job.id, job.lease_token, payload, false),
    true,
  );
  assert.deepEqual(await first, payload);
  assert.deepEqual(await second, payload);
  assert.deepEqual(await bridge.requestLocalData("market", args), payload);
  const count = await db.query(
    "SELECT count(*) FROM portal.local_data_requests WHERE args->>'testId'=$1",
    [testId],
  );
  assert.equal(Number(count.rows[0].count), 1);
});
