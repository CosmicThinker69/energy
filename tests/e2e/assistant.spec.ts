import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function login(page: Page, account: string, resetLibrary = false) {
  const response = await page.request.post("/api/auth/login", {
    data: { email: `${account}@demo.com`, password: "Demo123!" },
  });
  expect(response.ok()).toBeTruthy();
  if (resetLibrary) {
    expect(
      (await page.request.delete("/api/bot/documents/forecast.csv")).ok(),
    ).toBeTruthy();
  }
  await page.goto("/assistant");
}

test("assistant pages and APIs enforce sessions, subscriptions and administrator permissions", async ({
  page,
}) => {
  await page.goto("/assistant");
  await expect(page).toHaveURL("/login");
  expect((await page.request.get("/api/bot/status")).status()).toBe(401);
  await login(page, "basic");
  await expect(
    page.getByRole("heading", { name: "Access required" }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/bot/ask", { data: { question: "hello" } })
    ).status(),
  ).toBe(403);
  await login(page, "premium");
  await expect(
    page.getByRole("heading", { name: "Ask TEMO", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Add research documents")).toHaveCount(0);
  expect(
    (await page.request.post("/api/bot/upload", { multipart: {} })).status(),
  ).toBe(403);
  expect(
    (await page.request.delete("/api/bot/documents/forecast.csv")).status(),
  ).toBe(403);
});

test("admin uploads, asks through the real proxy, inspects sources, and removes shared research", async ({
  page,
}) => {
  test.skip(
    !process.env.BOT_INTEGRATION_TESTS,
    "Start the offline energy-bot fixture and set BOT_INTEGRATION_TESTS=1.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin", true);
  await expect(page.locator(".assistant-library .badge")).toHaveText("Ready");
  await expect(page.getByLabel("Your question")).toBeDisabled();
  await page.getByLabel("Add research documents").setInputFiles({
    name: "forecast.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "year,country,market_size\n2024,Bulgaria,12\n2025,Bulgaria,15\n2026,Bulgaria,18\n",
    ),
  });
  await expect(page.locator(".assistant-document-list")).toContainText(
    "forecast.csv",
  );
  await expect(page.getByLabel("Your question")).toBeEnabled();
  await page
    .getByLabel("Your question")
    .fill("Compare the forecasts for Bulgaria.");
  await page.getByRole("button", { name: "Ask TEMO", exact: true }).click();
  await expect(page.locator(".bot-result")).toContainText(
    "ANSWER based on context",
  );
  await expect(
    page.getByRole("region", { name: "Query result table" }),
  ).toContainText("2026");
  await expect(
    page.getByRole("img", { name: /Chart of Bulgaria/ }),
  ).toBeVisible();
  await page.getByText("SQL used", { exact: true }).click();
  await expect(page.locator(".bot-result pre")).toContainText("csv_forecast");
  await page.getByText("Sources (1)", { exact: true }).click();
  await expect(page.locator(".bot-sources")).toContainText("forecast.csv");
  await page.screenshot({
    path: "test-results/assistant-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Your question")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/assistant-mobile.png",
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .include(".assistant-layout")
    .analyze();
  expect(accessibility.violations).toEqual([]);

  // Model-generated markup is untrusted. Images and raw HTML must never execute.
  await page.route("**/api/bot/ask", (route) =>
    route.fulfill({
      json: {
        answer:
          "A safe answer. <script>window.botInjected=true</script> ![tracking](https://example.com/tracker.png)",
        route: "DOCS",
        sql: null,
        sql_error: null,
        table: null,
        sources: [],
      },
    }),
  );
  await page.getByLabel("Your question").fill("Check answer formatting.");
  await page.getByRole("button", { name: "Ask TEMO", exact: true }).click();
  await expect(page.locator(".bot-result").last()).toContainText(
    "A safe answer.",
  );
  await expect(page.locator(".bot-result img, .bot-result script")).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => "botInjected" in window)).toBe(false);
  await page.unroute("**/api/bot/ask");

  await page.getByRole("button", { name: "Remove forecast.csv" }).click();
  await page
    .getByRole("button", { name: "Keep document", exact: true })
    .click();
  await expect(page.locator(".assistant-document-list")).toContainText(
    "forecast.csv",
  );
  await page.getByRole("button", { name: "Remove forecast.csv" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".assistant-document-list")).toHaveCount(0);
  await expect(page.getByLabel("Your question")).toBeDisabled();
  await page.getByRole("button", { name: "Clear conversation" }).click();
  await expect(
    page.getByRole("heading", { name: "Start with a question" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("connection failures have a recoverable UI", async ({ page }) => {
  test.skip(
    !process.env.BOT_INTEGRATION_TESTS,
    "Start the offline energy-bot fixture and set BOT_INTEGRATION_TESTS=1.",
  );
  await page.route("**/api/bot/status", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "The research assistant is unavailable. Please try again shortly.",
      },
    }),
  );
  await login(page, "premium");
  await expect(
    page.locator(".assistant-composer").getByRole("alert"),
  ).toContainText("research assistant is unavailable");
  await expect(page.getByLabel("Your question")).toBeDisabled();
  await page.unroute("**/api/bot/status");
  await page.getByRole("button", { name: "Reconnect assistant" }).click();
  await expect(page.locator(".assistant-library .badge")).toHaveText("Ready");
  await expect(
    page.locator(".assistant-composer").getByRole("alert"),
  ).toHaveCount(0);
});
