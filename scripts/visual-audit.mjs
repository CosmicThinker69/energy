import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const failures = [];
const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
await mkdir("artifacts", { recursive: true });
for (const route of ["/login", "/register"]) {
  await page.goto("http://localhost:3000" + route);
  await page.locator("form").waitFor();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  failures.push({
    route,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes
        .map((n) => ({ target: n.target, summary: n.failureSummary }))
        .slice(0, 8),
    })),
  });
  await page.screenshot({
    path: `artifacts/${route.slice(1)}-desktop.png`,
    fullPage: true,
  });
}
await context.request.post("http://localhost:3000/api/auth/login", {
  data: { email: "premium@demo.com", password: "Demo123!", remember: true },
});
for (const route of [
  "/",
  "/dashboards",
  "/dashboards/day-ahead",
  "/explorer",
  "/settings",
  "/reports",
  "/help",
]) {
  await page.goto("http://localhost:3000" + route);
  await page.locator("h1:visible").waitFor();
  if (route === "/dashboards/day-ahead" || route === "/explorer")
    await page.locator("tbody tr:visible").first().waitFor();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  failures.push({
    route,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes
        .map((n) => ({ target: n.target, summary: n.failureSummary }))
        .slice(0, 8),
    })),
  });
  const slug = route === "/" ? "overview" : route.replaceAll("/", "-").slice(1);
  await page.screenshot({
    path: `artifacts/${slug}-desktop.png`,
    fullPage: true,
  });
}
const layout = [];
for (const width of [360, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of [
    "/",
    "/dashboards",
    "/dashboards/day-ahead",
    "/explorer",
    "/settings",
    "/reports",
    "/help",
  ]) {
    await page.goto("http://localhost:3000" + route);
    await page.locator("h1:visible").waitFor();
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.right > innerWidth + 2 &&
            getComputedStyle(el).position !== "fixed" &&
            !el.closest(".table-scroll") &&
            !el.closest(".sidebar")
          );
        })
        .slice(0, 6)
        .map((el) => el.className),
    }));
    if (overflow.document > width + 1)
      layout.push({ width, route, ...overflow });
    if (width === 390 && route === "/")
      await page.screenshot({
        path: "artifacts/overview-mobile.png",
        fullPage: true,
      });
  }
}
await writeFile(
  "artifacts/accessibility-audit.json",
  JSON.stringify({ accessibility: failures, layout, consoleErrors }, null, 2),
);
console.log(
  JSON.stringify(
    {
      accessibility: failures.filter((f) => f.violations.length),
      layout,
      consoleErrors,
    },
    null,
    2,
  ),
);
await browser.close();
