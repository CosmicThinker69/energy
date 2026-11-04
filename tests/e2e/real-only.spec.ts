import { test, expect } from "@playwright/test";

test("public login contains no invented price chart or seeded account shortcuts", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator(".demo-accounts")).toHaveCount(0);
  await expect(page.getByText("€87.42", { exact: false })).toHaveCount(0);
  await expect(page.locator(".auth-market-preview svg")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /simulated|illustrative/i,
  );
});

test("catalogue exposes only implemented real-data views and hides old report routes", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    data: { email: "premium@demo.com", password: "Demo123!" },
  });
  await page.goto("/dashboards");
  await expect(page.locator(".dashboard-card")).toHaveCount(9);
  await expect(
    page
      .locator(".dashboard-card")
      .filter({ hasText: "Advanced Market Intelligence" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".dashboard-card").filter({ hasText: "Balancing Market" }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /simulated|illustrative|updated 00:00/i,
  );
  await expect(
    page.getByRole("link", { name: "Reports", exact: true }),
  ).toHaveCount(0);
  for (const slug of ["balancing", "intelligence"]) {
    expect(
      (await page.request.get("/api/market?dashboard=" + slug)).status(),
    ).toBe(404);
    await page.goto("/dashboards/" + slug);
    await expect(
      page.getByRole("heading", { name: "This page is off the grid." }),
    ).toBeVisible();
  }
  expect(
    (await page.request.get("/api/reports/weekly-outlook?download=1")).status(),
  ).toBe(404);
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "This page is off the grid." }),
  ).toBeVisible();
});

test("displayed hourly prices reconcile to source intervals and empty future ranges stay empty", async ({
  request,
}) => {
  await request.post("/api/auth/login", {
    data: { email: "professional@demo.com", password: "Demo123!" },
  });
  const native = await request.get(
    "/api/data?source=entsoe&dataset=day_ahead_price&area=BG&start=2025-11-04&end=2025-11-05&limit=4",
  );
  expect(native.status()).toBe(200);
  const points = (await native.json()).data;
  const weighted = points.reduce(
    (
      s: number,
      p: { value: number; interval_start: string; interval_end: string },
    ) =>
      s + p.value * (Date.parse(p.interval_end) - Date.parse(p.interval_start)),
    0,
  );
  const duration = points.reduce(
    (s: number, p: { interval_start: string; interval_end: string }) =>
      s + Date.parse(p.interval_end) - Date.parse(p.interval_start),
    0,
  );
  const market = await request.get(
    "/api/market?date=2025-11-04&country=BG&days=1&resolution=hourly",
  );
  expect(market.status()).toBe(200);
  const data = await market.json();
  expect(data.mode).toBe("stored");
  expect(data.rows[0].price).toBeCloseTo(weighted / duration, 8);
  const future = await request.get(
    "/api/market?date=2050-01-01&country=BG&days=1&resolution=hourly",
  );
  expect(future.status()).toBe(200);
  const empty = await future.json();
  expect(empty.rows).toHaveLength(0);
  expect(empty.updatedAt).toBeNull();
  expect(empty.mode).toBe("stored");
});
