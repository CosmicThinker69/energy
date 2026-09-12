import { randomUUID } from "node:crypto";
import { scriptPool } from "./db";
import { passwordHash } from "../src/lib/server/password";

const accounts = ["basic", "professional", "premium"] as const;

async function main() {
  const pool = scriptPool();
  try {
    for (const plan of accounts) {
      await pool.query(
        `INSERT INTO portal.users
        (id, email, password_hash, first_name, last_name, company, plan, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT ((lower(email))) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         company = EXCLUDED.company,
         plan = EXCLUDED.plan,
         status = 'active',
         updated_at = now()`,
        [
          randomUUID(),
          `${plan}@demo.com`,
          passwordHash("Demo123!"),
          "Alex",
          "Morgan",
          "Meridian Energy",
          plan,
        ],
      );
    }
    console.log("Seeded three development accounts in portal.users.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Database seed failed.",
  );
  process.exitCode = 1;
});
