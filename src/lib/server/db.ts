import "server-only";
import { Pool, type QueryResultRow } from "pg";

declare global {
  var temoDatabasePool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Configure the PostgreSQL connection before starting TEMO.",
    );
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export const db = globalThis.temoDatabasePool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.temoDatabasePool = db;
}

export function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  return db.query<Row>(text, [...values]);
}
