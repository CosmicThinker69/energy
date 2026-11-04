import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess, canAccessPlan, plans } from "../src/lib/config";
import {
  formatNumber,
  marketAverage,
  toCsv,
  type MarketRow,
} from "../src/lib/market";

test("permissions increase by tier and remain centralized", () => {
  assert.equal(canAccessPlan("basic", "professional"), false);
  assert.equal(canAccessPlan("professional", "basic"), true);
  assert.equal(canAccessPlan("professional", "premium"), false);
  assert.equal(canAccessPlan("premium", "professional"), true);
  assert.equal(canAccess("basic", "explorer"), false);
  assert.equal(canAccess("professional", "explorer"), true);
  assert.equal(canAccess("professional", "reports"), false);
  for (const plan of plans) assert.equal(canAccess(plan, "overview"), true);
});
test("unreported statistics stay unavailable while real zero and negative values remain numeric", () => {
  assert.equal(formatNumber(undefined), "—");
  assert.equal(formatNumber(null), "—");
  assert.equal(formatNumber(NaN), "—");
  assert.equal(formatNumber(0), "0.00");
  assert.equal(formatNumber(-4.8), "-4.80");
  assert.ok(Number.isNaN(marketAverage([], "price")));
  const rows = [
    { price: null },
    { price: 0 },
    { price: -6 },
  ] as unknown as MarketRow[];
  assert.equal(marketAverage(rows, "price"), -3);
});
test("period statistics weight differently sized calendar buckets by their real duration", () => {
  const rows = [
    { price: 20, durationHours: 24 },
    { price: 40, durationHours: 48 },
  ] as unknown as MarketRow[];
  assert.equal(marketAverage(rows, "price"), 100 / 3);
});
test("CSV preserves later reported columns, missing values and negative numeric prices", () => {
  const csv = toCsv([{ price: -4.8 }, { price: 0, generation: 100 }]);
  assert.ok(csv.includes('"generation"'));
  assert.ok(csv.includes('"-4.8",""'));
  assert.ok(csv.includes('"0","100"'));
});
test("CSV neutralizes spreadsheet formulas and escapes quotes", () => {
  const csv = toCsv([
    { name: 'A "quoted" market', note: "=SUM(A1:A2)", value: 87.42 },
  ]);
  assert.ok(csv.includes('"A ""quoted"" market"'));
  assert.ok(csv.includes('"\'=SUM(A1:A2)"'));
  assert.ok(csv.startsWith("\uFEFF"));
});
