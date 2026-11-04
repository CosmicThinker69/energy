import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const marketMigrations = new Set([
  "003_energy_data.sql",
  "004_energy_source_metadata.sql",
]);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
  const client = await pool.connect();
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext('temo-schema-migrations'))",
    );
    await client.query("CREATE SCHEMA IF NOT EXISTS portal");
    await client.query(
      "CREATE TABLE IF NOT EXISTS portal.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (await readdir("migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      // In hybrid mode the full market schema belongs to the local data computer.
      if (
        process.env.DATA_BACKEND === "local-agent" &&
        marketMigrations.has(file)
      )
        continue;
      const sql = await readFile(join("migrations", file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        "SELECT checksum FROM portal.schema_migrations WHERE name=$1",
        [file],
      );
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum)
          throw Error(`Applied migration changed: ${file}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO portal.schema_migrations(name,checksum) VALUES($1,$2)",
          [file, checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock(hashtext('temo-schema-migrations'))",
    );
    client.release();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
