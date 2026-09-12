import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { scriptPool } from "./db";

async function main() {
  const pool = scriptPool();
  try {
    const directory = join(process.cwd(), "migrations");
    const files = (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    await pool.query("CREATE SCHEMA IF NOT EXISTS portal");
    await pool.query(`
    CREATE TABLE IF NOT EXISTS portal.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

    for (const file of files) {
      const sql = await readFile(join(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await pool.query<{ checksum: string }>(
        "SELECT checksum FROM portal.schema_migrations WHERE name = $1",
        [basename(file)],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Migration ${file} was changed after it was applied.`,
          );
        }
        console.log(`Already applied: ${file}`);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO portal.schema_migrations (name, checksum) VALUES ($1, $2)",
          [basename(file), checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
