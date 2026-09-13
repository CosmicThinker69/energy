import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, dashboards, plans } from "../src/lib/config";
import {
  countries,
  generateMarketRows,
  liveSnapshot,
  toCsv,
} from "../src/lib/market";
test("generation balances and night-time solar are coherent across all markets", () => {
  for (const country of countries) {
    const rows = generateMarketRows({
      country: country.code,
      date: "2026-09-09",
      days: 7,
    });
    for (const row of rows) {
      const technologies = [
        "solar",
        "wind",
        "hydro",
        "nuclear",
        "coal",
        "gas",
        "biomass",
      ];
      assert.equal(
        technologies.reduce((sum, key) => sum + Number(row[key]), 0),
        row.generation,
      );
      assert.ok(technologies.every((key) => Number(row[key]) >= 0));
      if (new Date(row.timestamp).getUTCHours() < 6) assert.equal(row.solar, 0);
      if (["GR", "RS", "PL"].includes(country.code))
        assert.equal(row.nuclear, 0);
    }
  }
});
test("overlapping windows return identical observations for the same timestamp", () => {
  const day = generateMarketRows({ date: "2026-09-09" });
  const week = generateMarketRows({ date: "2026-09-09", days: 7 }).slice(-24);
  day.forEach((row, i) => {
    for (const key of [
      "price",
      "generation",
      "balancing",
      "renewable",
      "volatility",
    ])
      assert.equal(row[key], week[i][key]);
  });
});
test("daily and monthly aggregates retain underlying values and negative-hour counts", () => {
  const params = { country: "GR", date: "2026-09-09", days: 30 };
  const hourly = generateMarketRows(params),
    daily = generateMarketRows({ ...params, resolution: "daily" }),
    monthly = generateMarketRows({ ...params, resolution: "monthly" });
  assert.equal(daily.length, 30);
  assert.equal(monthly.length, 2);
  assert.ok(
    Math.abs(
      daily.at(-1)!.price -
        hourly.slice(-24).reduce((sum, r) => sum + r.price, 0) / 24,
    ) < 0.01,
  );
  assert.equal(
    daily.reduce((sum, r) => sum + r.negative, 0),
    hourly.filter((r) => r.price < 0).length,
  );
  assert.equal(
    monthly.reduce((sum, r) => sum + r.volume, 0),
    hourly.reduce((sum, r) => sum + r.volume, 0),
  );
});
test("negative numeric prices remain numeric in CSV exports", () => {
  assert.ok(toCsv([{ price: -4.8 }]).includes('"-4.8"'));
});
test("permissions increase by tier and remain centralized", () => {
  assert.equal(dashboards.length, 11);
  assert.equal(dashboards.filter((d) => canAccess("basic", d.id)).length, 4);
  assert.equal(
    dashboards.filter((d) => canAccess("professional", d.id)).length,
    8,
  );
  assert.equal(dashboards.filter((d) => canAccess("premium", d.id)).length, 11);
  assert.equal(canAccess("basic", "explorer"), false);
  assert.equal(canAccess("professional", "explorer"), true);
  assert.equal(canAccess("professional", "reports"), false);
  for (const p of plans) assert.equal(canAccess(p, "overview"), true);
});
test("market history is deterministic with complete hourly coverage", () => {
  const query = { country: "BG", date: "2026-09-09", days: 30 };
  const a = generateMarketRows(query);
  assert.deepEqual(a, generateMarketRows(query));
  assert.equal(a.length, 720);
  assert.equal(new Set(a.map((r) => r.timestamp)).size, 720);
  assert.equal(a[0].timestamp, "2026-08-11T00:00:00.000Z");
  assert.equal(a.at(-1)?.timestamp, "2026-09-09T23:00:00.000Z");
});
test("hourly shapes capture the midday trough and evening ramp", () => {
  const rows = generateMarketRows({ date: "2026-09-09" });
  assert.ok(rows[19].price > rows[12].price + 20);
  assert.ok(rows[12].solar > rows[0].solar);
  for (const r of rows) {
    assert.equal(r.netFlow, r.export - r.import);
    assert.ok(r.renewable >= 0 && r.renewable <= 100);
  }
});
test("renewable-rich zones include negative midday scenarios", () => {
  const rows = generateMarketRows({
    country: "GR",
    date: "2026-09-09",
    days: 30,
  });
  const negative = rows.filter((r) => r.price < 0);
  assert.ok(negative.length > 0);
  assert.ok(
    negative.every(
      (r) =>
        new Date(r.timestamp).getUTCHours() >= 11 &&
        new Date(r.timestamp).getUTCHours() <= 14,
    ),
  );
});
test("live updates make small, bounded movements", () => {
  const time = Date.parse("2026-09-09T12:00:00Z");
  for (let i = 0; i < 100; i++) {
    const a = liveSnapshot(time + i * 5000),
      b = liveSnapshot(time + (i + 1) * 5000);
    assert.ok(Math.abs(a.price - b.price) < 0.12);
    assert.ok(Math.abs(a.generation - b.generation) <= 0.011);
    assert.ok(Math.abs(a.flow - b.flow) <= 2);
  }
});
test("CSV escapes quotes, line breaks, and spreadsheet formula prefixes", () => {
  const csv = toCsv([
    { name: 'A "quoted" market', note: "=SUM(A1:A2)", value: 87.42 },
  ]);
  assert.ok(csv.includes('"A ""quoted"" market"'));
  assert.ok(csv.includes('"\'=SUM(A1:A2)"'));
  assert.ok(csv.startsWith("\uFEFF"));
});
