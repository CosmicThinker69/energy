import { randomUUID } from "node:crypto";
import { scriptPool } from "./db";
import { passwordHash } from "../src/lib/server/password";

const accounts = [
  { email: "basic@demo.com", plan: "basic", role: "user" },
  { email: "professional@demo.com", plan: "professional", role: "user" },
  { email: "premium@demo.com", plan: "premium", role: "user" },
  { email: "admin@demo.com", plan: "premium", role: "admin" },
] as const;

const dashboards = [
  {
    slug: "entsoe-energy",
    title: "ENTSO-E Energy Dashboard",
    description:
      "Day-ahead electricity prices and actual generation mix from ENTSO-E.",
    category: "Market Data",
    viewerType: "streamlit",
    nativeKey: null,
    sourceUrl:
      process.env.STREAMLIT_ENTSOE_URL ||
      "https://energy-streamlit-production-d2ea.up.railway.app/",
    minimumPlan: "basic",
    badge: "LIVE DATA",
    enabled: true,
    sortOrder: 0,
  },
  {
    slug: "day-ahead",
    title: "Day-Ahead Electricity Prices",
    description: "Hourly electricity prices across European bidding zones.",
    category: "Prices",
    viewerType: "native",
    nativeKey: "day-ahead",
    sourceUrl: null,
    minimumPlan: "basic",
    badge: null,
    enabled: true,
    sortOrder: 10,
  },
  {
    slug: "energy-mix",
    title: "Energy Generation Mix",
    description:
      "Electricity production, broken down by generation technology.",
    category: "Generation",
    viewerType: "native",
    nativeKey: "energy-mix",
    sourceUrl: null,
    minimumPlan: "basic",
    badge: null,
    enabled: true,
    sortOrder: 20,
  },
  {
    slug: "regional",
    title: "Regional Price Comparison",
    description: "A connected view of prices and spreads across eight markets.",
    category: "Regional",
    viewerType: "native",
    nativeKey: "regional",
    sourceUrl: null,
    minimumPlan: "professional",
    badge: null,
    enabled: true,
    sortOrder: 30,
  },
  {
    slug: "balancing",
    title: "Balancing Market",
    description: "Upward and downward balancing prices and activated volumes.",
    category: "Balancing",
    viewerType: "native",
    nativeKey: "balancing",
    sourceUrl: null,
    minimumPlan: "professional",
    badge: null,
    enabled: true,
    sortOrder: 40,
  },
  {
    slug: "negative-prices",
    title: "Negative Price Analysis",
    description:
      "Track the frequency, duration, and drivers of negative prices.",
    category: "Prices",
    viewerType: "native",
    nativeKey: "negative-prices",
    sourceUrl: null,
    minimumPlan: "premium",
    badge: null,
    enabled: true,
    sortOrder: 50,
  },
  {
    slug: "renewables",
    title: "Renewable Generation",
    description: "Solar, wind, and hydro output across the energy transition.",
    category: "Generation",
    viewerType: "native",
    nativeKey: "renewables",
    sourceUrl: null,
    minimumPlan: "professional",
    badge: null,
    enabled: true,
    sortOrder: 60,
  },
  {
    slug: "cross-border",
    title: "Cross-Border Electricity Flows",
    description:
      "Explore electricity imports, exports, and interconnector use.",
    category: "Regional",
    viewerType: "native",
    nativeKey: "cross-border",
    sourceUrl: null,
    minimumPlan: "professional",
    badge: null,
    enabled: true,
    sortOrder: 70,
  },
  {
    slug: "historical",
    title: "Historical Market Analysis",
    description:
      "Put today in perspective with daily and monthly market trends.",
    category: "Research",
    viewerType: "native",
    nativeKey: "historical",
    sourceUrl: null,
    minimumPlan: "premium",
    badge: null,
    enabled: true,
    sortOrder: 80,
  },
  {
    slug: "country",
    title: "Bulgaria Market Overview",
    description: "A detailed view of Bulgaria’s prices, supply, and demand.",
    category: "Regional",
    viewerType: "native",
    nativeKey: "country",
    sourceUrl: null,
    minimumPlan: "basic",
    badge: null,
    enabled: true,
    sortOrder: 90,
  },
  {
    slug: "intelligence",
    title: "Advanced Market Intelligence",
    description:
      "Capture price signals, renewable capture rates, and volatility.",
    category: "Research",
    viewerType: "native",
    nativeKey: "intelligence",
    sourceUrl: null,
    minimumPlan: "premium",
    badge: null,
    enabled: true,
    sortOrder: 100,
  },
] as const;

async function main() {
  const pool = scriptPool();
  try {
    for (const account of accounts) {
      await pool.query(
        `INSERT INTO portal.users
        (id, email, password_hash, first_name, last_name, company, plan, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       ON CONFLICT ((lower(email))) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         company = EXCLUDED.company,
         plan = EXCLUDED.plan,
         role = EXCLUDED.role,
         status = 'active',
         updated_at = now()`,
        [
          randomUUID(),
          account.email,
          passwordHash("Demo123!"),
          "Alex",
          "Morgan",
          "Meridian Energy",
          account.plan,
          account.role,
        ],
      );
    }
    for (const dashboard of dashboards) {
      await pool.query(
        `INSERT INTO portal.dashboards
          (id, slug, title, description, category, viewer_type, native_key,
           source_url, minimum_plan, badge, enabled, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           viewer_type = EXCLUDED.viewer_type,
           native_key = EXCLUDED.native_key,
           source_url = EXCLUDED.source_url,
           minimum_plan = EXCLUDED.minimum_plan,
           badge = EXCLUDED.badge,
           enabled = EXCLUDED.enabled,
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
        [
          randomUUID(),
          dashboard.slug,
          dashboard.title,
          dashboard.description,
          dashboard.category,
          dashboard.viewerType,
          dashboard.nativeKey,
          dashboard.sourceUrl,
          dashboard.minimumPlan,
          dashboard.badge,
          dashboard.enabled,
          dashboard.sortOrder,
        ],
      );
    }
    console.log(
      `Seeded ${accounts.length} development accounts and ${dashboards.length} dashboards.`,
    );
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
