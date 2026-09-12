import { test, expect, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

loadEnvConfig(process.cwd());
let registeredEmail = "";

test.afterAll(async () => {
  if (!registeredEmail) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("DELETE FROM portal.users WHERE email = $1", [
      registeredEmail,
    ]);
  } finally {
    await pool.end();
  }
});

async function login(page: Page, plan = "basic") {
  await page.goto("/login");
  await page
    .getByRole("button", { name: new RegExp(`^${plan}$`, "i") })
    .click();
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: /Good .*Alex/ }),
  ).toBeVisible();
}
test("unauthenticated routes and APIs require a session", async ({
  page,
  request,
}) => {
  await page.goto("/explorer");
  await expect(page).toHaveURL("/login");
  expect((await request.get("/api/market?dashboard=balancing")).status()).toBe(
    401,
  );
  expect((await request.get("/api/stream")).status()).toBe(401);
});
test("basic account sees live data and remains locked out of higher tiers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByText("Markets live", { exact: true })).toBeVisible();
  const first = await page.locator(".kpi-value").first().innerText();
  await expect(async () => {
    expect(await page.locator(".kpi-value").first().innerText()).not.toBe(
      first,
    );
  }).toPass({ timeout: 12000 });
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await page.goto("/dashboards");
  await expect(page.locator(".dashboard-card")).toHaveCount(10);
  await expect(page.locator(".locked-action")).toHaveCount(7);
  expect(
    (await page.request.get("/api/market?dashboard=balancing")).status(),
  ).toBe(403);
  await page
    .getByRole("button", { name: "Requires Professional" })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Contact sales", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await expect(page.locator(".locked-action")).toHaveCount(7);
  expect(
    (await page.request.get("/api/market?dashboard=balancing")).status(),
  ).toBe(403);
  await page.goto("/dashboards/balancing");
  await expect(
    page.getByRole("heading", { name: "Access required" }),
  ).toBeVisible();
  await expect(page.locator(".analytics-kpis")).toHaveCount(0);
  await page.goto("/explorer");
  await expect(
    page.getByRole("heading", { name: "Access required" }),
  ).toBeVisible();
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Access required" }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Account & settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Your current plan" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
test("all analytics pages load and filters, tables, and CSV work", async ({
  page,
}) => {
  await login(page, "premium");
  const ids = [
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
  ];
  for (const id of ids) {
    await page.goto("/dashboards/" + id);
    await expect(page.locator(".analytics-kpis:visible")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Market data is temporarily unavailable",
      }),
    ).toHaveCount(0);
  }
  await page.goto("/dashboards/day-ahead");
  await page
    .getByRole("combobox", { name: "Market", exact: true })
    .selectOption("RO");
  await page
    .getByRole("combobox", { name: "Date range", exact: true })
    .selectOption("7");
  await expect(page.getByText("168 intervals", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Compare market", exact: true })
    .selectOption("GR");
  await expect(page.locator(".chart-legend")).toContainText("Greece");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("temo-day-ahead-RO.csv");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".pagination")).toContainText("Page 2");
  await page.screenshot({
    path: "test-results/analytics-desktop.png",
    fullPage: true,
  });
});
test("explorer filters, sorting, comparisons, pagination, and exports work", async ({
  page,
}) => {
  await login(page, "professional");
  await page.goto("/explorer");
  await expect(page.getByText("720", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Romania/ }).click();
  await expect(page.getByText("1,440", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".pagination")).toContainText("Page 2");
  await page.getByLabel("Filter records").fill("no-matching-record");
  await expect(
    page.getByRole("heading", { name: "No observations match your filter" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filter", exact: true }).click();
  await page
    .getByRole("button", { name: "Day-ahead price", exact: true })
    .click();
  await expect(page.locator('th[aria-sort="ascending"]')).toContainText(
    "Day-ahead price",
  );
  await page
    .getByRole("combobox", { name: "Metric", exact: true })
    .selectOption("price");
  await expect(page.locator("thead th")).toHaveCount(3);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export dataset", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "temo-explorer-filtered.csv",
  );
  expect((await page.request.get("/api/reports/weekly-outlook")).status()).toBe(
    403,
  );
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Access required" }),
  ).toBeVisible();
});
test("registration starts on Basic and profile changes persist", async ({
  page,
}) => {
  const email = `analyst-${Date.now()}@example.com`;
  registeredEmail = email;
  await page.goto("/register");
  await page.getByLabel("First name", { exact: true }).fill("Jordan");
  await page.getByLabel("Last name", { exact: true }).fill("Reed");
  await page.getByLabel("Company", { exact: true }).fill("Arc Energy");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Market123!");
  await page.getByLabel("Confirm password").fill("Market123!");
  await expect(page.getByText("Basic access included")).toBeVisible();
  await page.getByRole("button", { name: "Create your account" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /Jordan/ })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
  await page
    .getByLabel("Company", { exact: true })
    .fill("Arc Energy Analytics");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.reload();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Arc Energy Analytics",
  );
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Forgot your password?" }),
  ).toBeVisible();
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Get recovery link" }).click();
  await expect(
    page.getByRole("heading", { name: "Recovery request received" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Market123!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL("/");
});
test("mobile navigation, search, reports, and key pages fit viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "premium");
  for (const route of [
    "/",
    "/dashboards",
    "/dashboards/day-ahead",
    "/explorer",
    "/settings",
    "/reports",
    "/help",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1:visible")).toBeVisible();
    await expect(async () => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBe(false);
    }).toPass();
  }
  await page.goto("/");
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Market dashboards 10" }).click();
  await expect(page).toHaveURL("/dashboards");
  await page.getByRole("button", { name: "Search workspace" }).click();
  await page
    .getByRole("textbox", { name: "Search dashboards" })
    .fill("negative");
  await page.getByRole("button", { name: /Negative price analysis/ }).click();
  await expect(page).toHaveURL("/dashboards/negative-prices");
  await page.goto("/reports");
  await page
    .getByRole("button", { name: "Read report", exact: true })
    .first()
    .click();
  await expect(page.locator(".report-reader")).toBeVisible();
});
