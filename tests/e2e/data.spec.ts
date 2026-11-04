import { test, expect } from "@playwright/test";

test("stored data APIs enforce sessions and subscription access", async ({
  request,
}) => {
  expect((await request.get("/api/data/status")).status()).toBe(401);
  expect((await request.get("/api/data?source=entsoe")).status()).toBe(401);
  await request.post("/api/auth/login", {
    data: { email: "basic@demo.com", password: "Demo123!" },
  });
  expect((await request.get("/api/data/status")).status()).toBe(200);
  expect((await request.get("/api/data?source=entsoe")).status()).toBe(403);
  await request.post("/api/auth/logout", { data: {} });
  await request.post("/api/auth/login", {
    data: { email: "professional@demo.com", password: "Demo123!" },
  });
  expect((await request.get("/api/data?source=entsoe")).status()).toBe(400);
  const native = await request.get(
    "/api/data?source=entsoe&dataset=day_ahead_price&area=BG&start=2025-11-04&end=2025-11-05&limit=2",
  );
  expect(native.status()).toBe(200);
  const body = await native.json();
  expect(body.nextOffset).toBe(2);
  expect(body.data).toHaveLength(2);
  expect(body.data[0].unit).toBe("EUR/MWh");
  expect(body.data[0]).not.toHaveProperty("raw_id");
  const market = await request.get("/api/market?date=2025-11-04&country=BG");
  expect(market.status()).toBe(200);
  expect((await market.json()).mode).toBe("stored");
});

test("overview and source catalogue show stored data without fabricated market values", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    data: { email: "professional@demo.com", password: "Demo123!" },
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Market overview/ }),
  ).toBeVisible();
  await expect(page.getByText("Reported data", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Day average price", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open data catalogue" }).click();
  await expect(
    page.getByRole("heading", { name: "Data catalogue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Available observations" }),
  ).toBeVisible();
  await page.goto("/data?source=gie-agsi&dataset=gas_storage&area=BG");
  await expect(
    page.getByRole("heading", { name: "BG · gas storage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "TWh", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/stored-data-catalogue.png",
    fullPage: true,
  });
});
