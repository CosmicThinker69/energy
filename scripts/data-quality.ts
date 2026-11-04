import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";

loadEnvConfig(process.cwd());
async function main() {
  const { db } = await import("../src/lib/server/db");
  try {
    const { energyQuality } = await import("../src/lib/server/energy-quality");
    const result = await energyQuality();
    await mkdir(".data", { recursive: true });
    await writeFile(
      ".data/quality.json",
      JSON.stringify({ generatedAt: new Date(), ...result }, null, 2),
    );
    console.log(
      `Quality report: ${result.gaps.length} series with internal gaps, ${result.priceDisagreements.length} price differences, ${result.freshness.filter((r) => r.stale).length} stale datasets. Details: .data/quality.json`,
    );
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error(
    "Quality report failed. Check database connectivity and migrations.",
  );
  process.exitCode = 1;
});
