import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
let db: (typeof import("../src/lib/server/db"))["db"];
let storedMarketRows: (typeof import("../src/lib/server/energy-repository"))["storedMarketRows"];
const area = `QA_${Date.now()}`;
let rawId: number;
before(async () => {
  ({ db } = await import("../src/lib/server/db"));
  ({ storedMarketRows } = await import("../src/lib/server/energy-repository"));
  const raw = await db.query(
    `INSERT INTO energy.raw_responses(source,request,sha256,content_type,payload_gzip)
    VALUES('entsoe','{}',$1,'text/plain',$2) RETURNING id`,
    [area, Buffer.from("test fixture")],
  );
  rawId = raw.rows[0].id;
  // Half-hourly coverage and a missing quarter hour exercise real overlap arithmetic.
  for (const [minute, end, value] of [
    [0, 30, -10],
    [30, 45, 50],
    [45, 60, 90],
    [60, 75, 20],
    [90, 120, 80],
  ]) {
    await db.query(
      `INSERT INTO energy.observations(source,dataset,area,metric,dimension_key,interval_start,interval_end,value,unit,raw_id)
      VALUES('entsoe','day_ahead_price',$1,'price','{}',$2,$3,$4,'EUR/MWh',$5)`,
      [
        area,
        new Date(Date.UTC(2025, 10, 4, 0, minute)),
        new Date(Date.UTC(2025, 10, 4, 0, end)),
        value,
        rawId,
      ],
    );
  }
});
after(async () => {
  await db.query(
    "DELETE FROM energy.observation_revisions WHERE previous_record->>'area'=$1",
    [area],
  );
  await db.query("DELETE FROM energy.observations WHERE area=$1", [area]);
  await db.query("DELETE FROM energy.raw_responses WHERE id=$1", [rawId]);
  await db.end();
});

test("stored prices use duration weights and leave partially covered hours unavailable", async () => {
  const data = await storedMarketRows({
    country: area,
    date: "2025-11-04",
    days: 1,
    resolution: "hourly",
  });
  assert.equal(data.rows.length, 2);
  assert.equal(data.rows[0].price, 30); // (-10*30+50*15+90*15)/60
  assert.equal(data.rows[0].negativeHours, 0.5);
  assert.equal(data.rows[1].price, null);
  assert.equal(data.rows[0].generation, undefined);
  assert.equal(data.mode, "stored");
  const negative = await storedMarketRows({
    country: area,
    date: "2025-11-04",
    days: 1,
    resolution: "quarter-hourly",
  });
  assert.equal(negative.rows[0].price, -10);
});

test("stored provider revisions are archived only when data changes", async () => {
  await db.query(
    "UPDATE energy.observations SET last_seen_at=now() WHERE area=$1",
    [area],
  );
  const before = await db.query(
    "SELECT count(*) FROM energy.observation_revisions WHERE previous_record->>'area'=$1",
    [area],
  );
  assert.equal(Number(before.rows[0].count), 0);
  await db.query("UPDATE energy.observations SET value=value+1 WHERE area=$1", [
    area,
  ]);
  const after = await db.query(
    "SELECT count(*) FROM energy.observation_revisions WHERE previous_record->>'area'=$1",
    [area],
  );
  assert.equal(Number(after.rows[0].count), 5);
});

test("a whole missing technology hour is not silently counted as zero generation", async () => {
  for (const [metric, startHour, endHour, value] of [
    ["solar", 0, 3, 10],
    ["nuclear", 0, 1, 30],
    ["nuclear", 2, 3, 40],
  ] as const) {
    await db.query(
      `INSERT INTO energy.observations(source,dataset,area,metric,dimensions,dimension_key,interval_start,interval_end,value,unit,raw_id)
      VALUES('entsoe','generation',$1,$2,'{"measurement":"generation"}','generation',$3,$4,$5,'MW',$6)`,
      [
        area,
        metric,
        new Date(Date.UTC(2025, 10, 4, startHour)),
        new Date(Date.UTC(2025, 10, 4, endHour)),
        value,
        rawId,
      ],
    );
  }
  const result = await storedMarketRows({
    country: area,
    date: "2025-11-04",
    days: 1,
    resolution: "hourly",
  });
  assert.equal(result.rows[0].generation, 40);
  assert.equal(result.rows[1].nuclear, null);
  assert.equal(result.rows[1].generation, undefined);
  assert.equal(result.rows[2].generation, 50);
});
