import { test, expect } from "@playwright/test";
test("API validation, forged access, session persistence, and reset revocation", async ({
  request,
}) => {
  const email = `api-${Date.now()}@example.com`;
  const input = {
    firstName: "Dana",
    lastName: "Reed",
    company: "North Grid",
    email,
    password: "Secure123!",
    confirmPassword: "Secure123!",
    plan: "basic",
    remember: true,
  };
  expect(
    (
      await request.post("/api/auth/register", {
        data: { ...input, confirmPassword: "Mismatch123!" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/register", {
        data: input,
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  const registered = await request.post("/api/auth/register", { data: input });
  expect(registered.status()).toBe(200);
  expect(registered.headers()["set-cookie"]).toContain("HttpOnly");
  expect(registered.headers()["set-cookie"]).toContain("Max-Age=2592000");
  expect((await request.get("/api/auth/session")).status()).toBe(200);
  expect(
    (
      await request.get("/api/market?dashboard=balancing&plan=premium")
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/reports/weekly-outlook")).status()).toBe(403);
  expect(
    (
      await request.patch("/api/account", { data: { plan: "administrator" } })
    ).status(),
  ).toBe(400);
  expect((await request.get("/api/market?country=XX")).status()).toBe(400);
  expect(
    (await request.get("/api/market?days=365&resolution=hourly")).status(),
  ).toBe(400);
  expect((await request.get("/api/market?date=2026-02-31")).status()).toBe(400);
  const forgotten = await request.post("/api/auth/forgot", { data: { email } });
  const { resetUrl } = await forgotten.json();
  const token = new URL(resetUrl, "http://localhost:3000").searchParams.get(
    "token",
  );
  expect(
    (
      await request.post("/api/auth/reset", {
        data: { token, password: "Changed123!" },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/auth/session")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/reset", {
        data: { token, password: "Another123!" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email, password: "Secure123!" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email, password: "Changed123!" },
      })
    ).status(),
  ).toBe(200);
  expect((await request.post("/api/auth/logout", { data: {} })).status()).toBe(
    200,
  );
  expect((await request.get("/api/auth/session")).status()).toBe(401);
});
