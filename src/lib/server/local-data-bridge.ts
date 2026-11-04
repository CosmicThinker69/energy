import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { db, query } from "./db";

export type LocalDataOperation =
  "market" | "coverage" | "observations" | "quality" | "collection";
const operations = new Set<LocalDataOperation>([
  "market",
  "coverage",
  "observations",
  "quality",
  "collection",
]);
export class LocalDataUnavailable extends Error {
  constructor() {
    super(
      "The local data service is offline or busy. Keep the TEMO data agent running on the data computer.",
    );
  }
}
export function validAgentToken(header: string | null) {
  const secret = process.env.LOCAL_DATA_AGENT_TOKEN;
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer "))
    return false;
  const expected = createHash("sha256").update(secret).digest();
  const supplied = createHash("sha256").update(header.slice(7)).digest();
  return timingSafeEqual(expected, supplied);
}
export function validOperation(
  operation: unknown,
): operation is LocalDataOperation {
  return (
    typeof operation === "string" &&
    operations.has(operation as LocalDataOperation)
  );
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function localAgentStatus() {
  const result = await query<{
    last_seen_at: Date | null;
    online: boolean;
  }>(`SELECT max(last_seen_at) AS last_seen_at,
    coalesce(max(last_seen_at)>now()-interval '45 seconds',false) AS online FROM portal.local_data_agents`);
  return result.rows[0];
}

export async function requestLocalData<T>(
  operation: LocalDataOperation,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!(await localAgentStatus()).online) throw new LocalDataUnavailable();
  const key = createHash("sha256")
    .update(JSON.stringify([operation, args]))
    .digest("hex");
  const client = await db.connect();
  let id: string;
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO portal.local_data_requests(id,cache_key,operation,args)
      VALUES($1,$2,$3,$4) ON CONFLICT(cache_key) DO NOTHING`,
      [randomUUID(), key, operation, JSON.stringify(args)],
    );
    const current = await client.query(
      `SELECT *,expires_at>now() AS fresh,lease_until>now() AS leased
      FROM portal.local_data_requests WHERE cache_key=$1 FOR UPDATE`,
      [key],
    );
    const row = current.rows[0];
    id = row.id;
    if (row.status === "complete" && row.fresh) {
      await client.query("COMMIT");
      return row.result as T;
    }
    if (
      row.status === "failed" ||
      !row.fresh ||
      (row.status === "running" && !row.leased)
    ) {
      await client.query(
        `UPDATE portal.local_data_requests SET status='queued',result=NULL,error=NULL,
        lease_token=NULL,lease_until=NULL,created_at=now(),updated_at=now(),expires_at=now()+interval '2 minutes' WHERE id=$1`,
        [id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const deadline = Date.now() + 35_000;
  while (Date.now() < deadline) {
    const response = await query<{ status: string; result: T }>(
      `SELECT status,result FROM portal.local_data_requests WHERE id=$1`,
      [id],
    );
    const row = response.rows[0];
    if (row?.status === "complete") return row.result;
    if (row?.status === "failed") throw new LocalDataUnavailable();
    await delay(200);
  }
  throw new LocalDataUnavailable();
}

export async function pollAgent(
  id: string,
  slots: number,
  signal?: AbortSignal,
) {
  await query(
    `INSERT INTO portal.local_data_agents(id,version) VALUES($1,'1')
    ON CONFLICT(id) DO UPDATE SET last_seen_at=now(),version=excluded.version`,
    [id],
  );
  if (slots === 0) return [];
  // Remove caches after their TTL, allowing currently awaited work to finish.
  await query(
    `DELETE FROM portal.local_data_requests WHERE expires_at<now()-interval '2 minutes'`,
  );
  await query(
    `DELETE FROM portal.local_data_agents WHERE last_seen_at<now()-interval '1 day'`,
  );
  const deadline = Date.now() + 12_000;
  while (!signal?.aborted && Date.now() < deadline) {
    const result = await query(
      `WITH picked AS (
      SELECT id FROM portal.local_data_requests WHERE expires_at>now() AND
        (status='queued' OR status='running' AND lease_until<now()) ORDER BY created_at
      LIMIT $1 FOR UPDATE SKIP LOCKED
    ) UPDATE portal.local_data_requests r SET status='running',lease_token=gen_random_uuid(),
      lease_until=now()+interval '90 seconds',updated_at=now() FROM picked WHERE r.id=picked.id
      RETURNING r.id,r.operation,r.args,r.lease_token`,
      [slots],
    );
    if (result.rows.length) return result.rows;
    await delay(750);
  }
  return [];
}

export async function acceptAgentResult(
  id: string,
  lease: string,
  result: unknown,
  failed: boolean,
) {
  const updated = await query(
    `UPDATE portal.local_data_requests SET status=$3,result=$4,error=$5,
      expires_at=now()+CASE operation WHEN 'quality' THEN interval '15 minutes'
      WHEN 'coverage' THEN interval '1 minute' WHEN 'collection' THEN interval '15 seconds' ELSE interval '20 seconds' END,
      updated_at=now(),lease_until=NULL
    WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING id`,
    [
      id,
      lease,
      failed ? "failed" : "complete",
      failed ? null : JSON.stringify(result),
      failed ? "Local data query failed" : null,
    ],
  );
  return updated.rowCount === 1;
}
