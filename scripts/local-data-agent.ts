import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import type { ObservationQuery } from "../src/lib/server/energy-repository";

loadEnvConfig(process.cwd());
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Job = {
  id: string;
  lease_token: string;
  operation: string;
  args: Record<string, unknown>;
};

async function main() {
  const address = process.env.LOCAL_DATA_CLOUD_URL;
  const token = process.env.LOCAL_DATA_AGENT_TOKEN;
  if (!address || !token || token.length < 32)
    throw Error(
      "Configure LOCAL_DATA_CLOUD_URL and a LOCAL_DATA_AGENT_TOKEN of at least 32 characters.",
    );
  const base = new URL(address);
  if (
    base.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(base.hostname)
  )
    throw Error("The hosted endpoint must use HTTPS.");
  const endpoint = new URL("/api/local-data/agent", base);
  process.env.DATA_AGENT_READ_ONLY = "1";
  const { db } = await import("../src/lib/server/db");
  // A separate session holds the lifetime lock while pool clients execute reads.
  const guard = await db.connect();
  const lock = await guard.query(
    "SELECT pg_try_advisory_lock(hashtext('temo-local-data-agent')) AS acquired",
  );
  if (!lock.rows[0].acquired) {
    guard.release();
    await db.end();
    console.log("A local data agent is already running.");
    return;
  }
  const repository = await import("../src/lib/server/energy-repository");
  const { energyQuality } = await import("../src/lib/server/energy-quality");
  const { countries } = await import("../src/lib/market");
  const agentId = randomUUID();
  const active = new Set<Promise<void>>();
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      stopping = true;
    });
  async function send(body: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok)
      throw Error(`Hosted bridge returned HTTP ${response.status}`);
    return response.json();
  }
  async function execute(job: Job) {
    let result: unknown;
    let failed = false;
    try {
      const a = job.args;
      if (job.operation === "market") {
        if (
          typeof a.country !== "string" ||
          !countries.some((c) => c.code === a.country) ||
          !Number.isInteger(a.days) ||
          Number(a.days) < 1 ||
          Number(a.days) > 730 ||
          !["hourly", "quarter-hourly", "daily", "monthly"].includes(
            String(a.resolution),
          ) ||
          (a.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(a.date)))
        )
          throw Error("Invalid market query");
        if (
          (a.resolution === "hourly" && Number(a.days) > 30) ||
          (a.resolution === "quarter-hourly" && Number(a.days) > 7)
        )
          throw Error("Query exceeds resolution limits");
        result = await repository.storedMarketRows(a);
      } else if (job.operation === "coverage")
        result = await repository.dataCoverage();
      else if (job.operation === "quality") result = await energyQuality();
      else if (job.operation === "collection")
        result = await repository.collectionStatus();
      else if (job.operation === "observations") {
        const from = Date.parse(String(a.start)),
          to = Date.parse(String(a.end));
        if (
          !repository.ENERGY_SOURCES.includes(String(a.source)) ||
          typeof a.dataset !== "string" ||
          a.dataset.length > 100 ||
          typeof a.area !== "string" ||
          a.area.length > 100 ||
          !Number.isFinite(from) ||
          !Number.isFinite(to) ||
          to <= from ||
          to - from > 366 * 86400000 ||
          !Number.isInteger(a.limit) ||
          Number(a.limit) < 1 ||
          Number(a.limit) > 5000 ||
          !Number.isInteger(a.offset) ||
          Number(a.offset) < 0 ||
          Number(a.offset) > 1000000
        )
          throw Error("Invalid observations query");
        result = await repository.observationPage(a as ObservationQuery);
      } else throw Error("Unsupported operation");
    } catch {
      failed = true;
      console.error(
        new Date().toISOString(),
        `${job.operation}: local query failed`,
      );
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await send({
          action: "result",
          id: job.id,
          lease: job.lease_token,
          result,
          failed,
        });
        return;
      } catch {
        await pause(2000 * (attempt + 1));
      }
    }
    console.error(
      new Date().toISOString(),
      "Result delivery failed; the hosted request can be retried.",
    );
  }
  console.log(
    new Date().toISOString(),
    "TEMO data agent started. Connections are outbound; local PostgreSQL is not exposed.",
  );
  try {
    while (!stopping) {
      // Free a slot as soon as a read finishes. Polling with zero free slots
      // would otherwise hold the next batch behind an unnecessary long poll.
      if (active.size >= 3) {
        await Promise.race([...active, pause(10_000)]);
        continue;
      }
      try {
        const response = await send({
          action: "poll",
          agentId,
          slots: Math.max(0, 3 - active.size),
        });
        for (const job of response.jobs as Job[]) {
          const work = execute(job);
          active.add(work);
          void work.finally(() => active.delete(work));
        }
      } catch {
        console.error(
          new Date().toISOString(),
          "Hosted data bridge unavailable; reconnecting in 5 seconds.",
        );
        await pause(5000);
      }
    }
    await Promise.all(active);
  } finally {
    guard.release();
    await db.end();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Local data agent failed.",
  );
  process.exitCode = 1;
});
