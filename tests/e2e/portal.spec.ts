import { test, expect, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

loadEnvConfig(process.cwd());
let registeredEmail = "";
const managedDashboardSlug = `managed-streamlit-${Date.now()}`;

test.afterAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (registeredEmail) {
      await pool.query("DELETE FROM portal.users WHERE email = $1", [
        registeredEmail,
      ]);
    }
    await pool.query("DELETE FROM portal.dashboards WHERE slug = $1", [
      managedDashboardSlug,
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
async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill("admin@demo.com");
  await page.getByLabel("Password", { exact: true }).fill("Demo123!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page).toHaveURL("/");
}
test("unauthenticated routes and APIs require a session", async ({
  page,
  request,
}) => {
  await page.goto("/explorer");
  await expect(page).toHaveURL("/login");
  await page.goto("/dashboards/entsoe-energy");
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
  const firstUpdate = await page.locator(".header-live small").innerText();
  await expect(async () => {
    expect(await page.locator(".header-live small").innerText()).not.toBe(
      firstUpdate,
    );
  }).toPass({ timeout: 12000 });
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await page.goto("/dashboards");
  await expect(page.locator(".dashboard-card")).toHaveCount(11);
  await expect(page.locator(".dashboard-card").first()).toContainText(
    "ENTSO-E Energy",
  );
  const sidebar = page.locator(".sidebar");
  await expect(
    sidebar.getByText("Administration", { exact: true }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole("link", { name: "Dashboard registry" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(
    page.locator(".profile-menu").getByRole("link", {
      name: "Dashboard registry",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close account menu" }).click();
  await expect(
    sidebar.getByRole("link", { name: /Market dashboards/ }),
  ).toHaveAttribute("aria-current", "page");
  for (const duplicateLink of [
    "Prices",
    "Generation",
    "Balancing",
    "Regional markets",
  ]) {
    await expect(
      sidebar.getByRole("link", { name: duplicateLink, exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page
      .locator(".dashboard-card")
      .filter({ hasText: "ENTSO-E Energy" })
      .getByText("LIVE DATA", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-library-desktop.png",
    fullPage: true,
  });
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
    page.locator(".sidebar").getByRole("link", { name: /Market dashboards/ }),
  ).toHaveAttribute("aria-current", "page");
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
  await page.goto("/admin/dashboards");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("admin can add, edit, disable, reorder, and delete a dynamic Streamlit dashboard", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const title = "Managed Streamlit Dashboard";
  await loginAdmin(page);
  const adminSidebar = page.locator(".sidebar");
  await expect(
    adminSidebar.getByText("Administration", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(
    page.locator(".profile-menu").getByRole("link", {
      name: "Dashboard registry",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close account menu" }).click();
  await adminSidebar.getByRole("link", { name: "Dashboard registry" }).click();
  await expect(page).toHaveURL("/admin/dashboards");
  await expect(
    page.getByRole("heading", { name: "Dashboard registry" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add dashboard" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Slug", { exact: true }).fill(managedDashboardSlug);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A dashboard registered entirely through TEMO Admin.");
  await page.getByLabel("Category", { exact: true }).fill("Testing");
  await page
    .getByRole("combobox", { name: "Dashboard type" })
    .selectOption("streamlit");
  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://example.com/streamlit-app");
  await page
    .getByRole("combobox", { name: "Minimum access" })
    .selectOption("basic");
  await page.getByLabel("Badge", { exact: true }).fill("BETA");
  await page.getByRole("button", { name: "Save dashboard" }).click();
  await expect(page.getByRole("status")).toContainText("Dashboard added");
  const row = page.locator("tbody tr").filter({ hasText: title });
  await expect(row).toContainText(managedDashboardSlug);
  await row.getByRole("button", { name: `Move ${title} up` }).click();
  await expect(page.getByRole("status")).toContainText(
    "Dashboard order updated",
  );

  await page.goto("/dashboards");
  await expect(
    page.getByRole("link", { name: "Market dashboards 12" }),
  ).toBeVisible();
  await expect(
    page.locator(".dashboard-card").filter({ hasText: title }),
  ).toBeVisible();
  await page.goto(`/dashboards/${managedDashboardSlug}`);
  const iframe = page.locator(`#main-content iframe[title="${title}"]`);
  await expect(iframe).toHaveAttribute(
    "src",
    /example\.com\/streamlit-app\?embed=true$/,
  );

  await page.goto("/admin/dashboards");
  const editableRow = page.locator("tbody tr").filter({ hasText: title });
  await editableRow.getByRole("button", { name: "Edit" }).click();
  await page
    .getByRole("combobox", { name: "Minimum access" })
    .selectOption("professional");
  await page.getByRole("button", { name: "Save dashboard" }).click();
  await expect(page.getByRole("status")).toContainText("Dashboard updated");

  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "basic");
  await page.goto(`/dashboards/${managedDashboardSlug}`);
  await expect(
    page.getByRole("heading", { name: "Access required" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await loginAdmin(page);
  await page.goto("/admin/dashboards");
  const managedRow = page.locator("tbody tr").filter({ hasText: title });
  await managedRow.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByRole("status")).toContainText("Dashboard disabled");
  await page.goto("/dashboards");
  await expect(
    page.getByRole("link", { name: "Market dashboards 11" }),
  ).toBeVisible();
  await expect(
    page.locator(".dashboard-card").filter({ hasText: title }),
  ).toHaveCount(0);
  await page.goto(`/dashboards/${managedDashboardSlug}`);
  await expect(
    page.getByRole("heading", { name: "This page is off the grid." }),
  ).toBeVisible();

  await page.goto("/admin/dashboards");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator("tbody tr")
    .filter({ hasText: title })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("status")).toContainText("metadata deleted");
  await expect(page.locator("tbody tr").filter({ hasText: title })).toHaveCount(
    0,
  );
});
test("ENTSO-E Streamlit viewer is available to every authenticated plan", async ({
  page,
}) => {
  await login(page, "basic");
  await page.goto("/dashboards/entsoe-energy");
  await expect(
    page.getByRole("heading", { name: "ENTSO-E Energy Dashboard" }),
  ).toBeVisible();
  const iframe = page.locator(
    '#main-content iframe[title="ENTSO-E Energy Dashboard"]',
  );
  await expect(iframe).toHaveAttribute("src", /\?embed=true$/);
  await expect(
    page
      .frameLocator('#main-content iframe[title="ENTSO-E Energy Dashboard"]')
      .getByRole("heading", { name: /ENTSO-E Energy Dashboard/ }),
  ).toBeVisible({ timeout: 30_000 });
  await page.screenshot({
    path: "test-results/entsoe-streamlit.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/dashboards/entsoe-energy");
  await expect(page).toHaveURL("/login");

  for (const plan of ["professional", "premium"]) {
    await login(page, plan);
    await page.goto("/dashboards/entsoe-energy");
    await expect(
      page.locator('#main-content iframe[title="ENTSO-E Energy Dashboard"]'),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("/login");
  }
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
  await page.screenshot({
    path: "test-results/navigation-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Market dashboards 11" }).click();
  await expect(page).toHaveURL("/dashboards");
  await page.getByRole("button", { name: "Search workspace" }).click();
  await page
    .getByRole("textbox", { name: "Search dashboards" })
    .fill("negative");
  await page.getByRole("button", { name: /Negative Price Analysis/i }).click();
  await expect(page).toHaveURL("/dashboards/negative-prices");
  await page.goto("/reports");
  await page
    .getByRole("button", { name: "Read report", exact: true })
    .first()
    .click();
  await expect(page.locator(".report-reader")).toBeVisible();
});
