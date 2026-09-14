import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, before, test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { canAccessPlan } from "../src/lib/config";

loadEnvConfig(process.cwd());

const slug = `registry-test-${Date.now()}`;
let dashboardRepository: (typeof import("../src/lib/server/dashboard-repository"))["dashboardRepository"];
let DashboardValidationError: (typeof import("../src/lib/server/dashboard-repository"))["DashboardValidationError"];
let query: (typeof import("../src/lib/server/db"))["query"];
let db: (typeof import("../src/lib/server/db"))["db"];
let adminId = "";

before(async () => {
  ({ dashboardRepository, DashboardValidationError } =
    await import("../src/lib/server/dashboard-repository"));
  ({ query, db } = await import("../src/lib/server/db"));
  const admin = await query<{ id: string }>(
    "SELECT id FROM portal.users WHERE email = $1 AND role = 'admin' LIMIT 1",
    ["admin@demo.com"],
  );
  adminId = admin.rows[0]?.id || "";
  assert.ok(adminId, "Run npm run db:seed before the registry tests.");
});

after(async () => {
  await query("DELETE FROM portal.dashboards WHERE slug = $1", [slug]);
  await db.end();
});

test("PostgreSQL dashboard registry is dynamic, validated, and seed-safe", async () => {
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"],
    { cwd: process.cwd(), stdio: "ignore" },
  );
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"],
    { cwd: process.cwd(), stdio: "ignore" },
  );
  const seeded = await query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM portal.dashboards
     WHERE slug = ANY($1::text[])`,
    [
      [
        "entsoe-energy",
        "day-ahead",
        "energy-mix",
        "regional",
        "balancing",
        "negative-prices",
        "renewables",
        "cross-border",
        "historical",
        "country",
        "intelligence",
      ],
    ],
  );
  assert.equal(Number(seeded.rows[0].count), 11);

  const enabled = await dashboardRepository.getEnabledDashboards();
  assert.equal(enabled[0].slug, "entsoe-energy");
  assert.ok(enabled.every((dashboard) => dashboard.enabled));

  const created = await dashboardRepository.createDashboard(
    {
      slug,
      title: "Dynamic Streamlit Test",
      description: "Created without a Next.js route.",
      category: "Testing",
      viewerType: "streamlit",
      nativeKey: null,
      sourceUrl: "https://example.com/streamlit",
      minimumPlan: "professional",
      badge: "BETA",
      enabled: true,
      sortOrder: 9000,
    },
    adminId,
  );
  assert.equal(
    (await dashboardRepository.getDashboardBySlug(slug))?.id,
    created.id,
  );
  assert.equal(canAccessPlan("basic", created.minimumPlan), false);
  assert.equal(canAccessPlan("professional", created.minimumPlan), true);

  const upgraded = await dashboardRepository.updateDashboard(
    created.id,
    { ...created, minimumPlan: "premium" },
    adminId,
  );
  assert.equal(upgraded.minimumPlan, "premium");
  assert.equal(canAccessPlan("professional", upgraded.minimumPlan), false);
  assert.equal(canAccessPlan("premium", upgraded.minimumPlan), true);

  await dashboardRepository.setDashboardEnabled(created.id, false, adminId);
  assert.equal(await dashboardRepository.getDashboardBySlug(slug), null);
  assert.equal(
    (await dashboardRepository.getDashboardBySlug(slug, true))?.enabled,
    false,
  );
  assert.equal(
    (await dashboardRepository.getEnabledDashboards()).some(
      (dashboard) => dashboard.slug === slug,
    ),
    false,
  );

  await assert.rejects(
    dashboardRepository.updateDashboard(
      created.id,
      {
        ...created,
        viewerType: "native",
        nativeKey: "arbitrary-python-key",
        sourceUrl: null,
      },
      adminId,
    ),
    DashboardValidationError,
  );
  await assert.rejects(
    dashboardRepository.createDashboard(
      {
        slug: `${slug}-unsafe-url`,
        title: "Unsafe URL",
        description: "",
        category: "Testing",
        viewerType: "streamlit",
        nativeKey: null,
        sourceUrl: "ftp://user:password@example.com/dashboard",
        minimumPlan: "basic",
        badge: null,
        enabled: true,
        sortOrder: 9001,
      },
      adminId,
    ),
    DashboardValidationError,
  );

  await dashboardRepository.deleteDashboard(created.id);
  assert.equal(await dashboardRepository.getDashboardBySlug(slug, true), null);
});
