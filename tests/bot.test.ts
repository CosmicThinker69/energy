import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { loadEnvConfig } from "@next/env";
import type { PublicUser } from "../src/lib/config";

loadEnvConfig(process.cwd());
const originalUrl = process.env.BOT_SERVICE_URL;
const originalToken = process.env.BOT_SERVICE_TOKEN;
const secret = "test-secret-with-at-least-32-characters";
const premium: PublicUser = {
  id: "test",
  firstName: "Dana",
  lastName: "Reed",
  email: "dana@example.com",
  company: "Grid",
  plan: "premium",
  role: "user",
  createdAt: "2026-01-01",
};
let forward: (typeof import("../src/lib/server/bot"))["forwardBotRequest"];
let server: Server;
let origin: string;
const calls: {
  path: string;
  token?: string;
  cookie?: string;
  body: string;
  contentType?: string;
}[] = [];

before(async () => {
  ({ forwardBotRequest: forward } = await import("../src/lib/server/bot"));
  server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    calls.push({
      path: request.url || "",
      token: request.headers["x-temo-service-token"] as string,
      cookie: request.headers.cookie,
      body,
      contentType: request.headers["content-type"],
    });
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/status")
      response.end(
        JSON.stringify({
          llm_ok: true,
          chunks: 12,
          tables: 2,
          llm_error: "PRIVATE INTERNAL ERROR",
          llm_model: "private-model",
        }),
      );
    else if (request.url === "/api/ask" && body.includes("upstream failure")) {
      response.statusCode = 503;
      response.end(
        JSON.stringify({ detail: "PRIVATE credentials and server path" }),
      );
    } else if (request.url === "/api/ask")
      response.end(
        JSON.stringify({
          answer: "A cited answer",
          route: "DOCS",
          sql: null,
          sql_error: null,
          table: null,
          sources: [],
        }),
      );
    else response.end(JSON.stringify([]));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  process.env.BOT_SERVICE_URL = origin;
  process.env.BOT_SERVICE_TOKEN = secret;
});

after(async () => {
  if (originalUrl === undefined) delete process.env.BOT_SERVICE_URL;
  else process.env.BOT_SERVICE_URL = originalUrl;
  if (originalToken === undefined) delete process.env.BOT_SERVICE_TOKEN;
  else process.env.BOT_SERVICE_TOKEN = originalToken;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function request(
  path: string,
  method = "GET",
  data?: unknown,
  headers?: Record<string, string>,
) {
  return new Request(`http://localhost/api/bot/${path}`, {
    method,
    headers: {
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

test("assistant rejects unauthenticated, lower-plan, forged-origin and non-admin requests before contacting bot", async () => {
  const count = calls.length;
  assert.equal(
    (await forward(request("status"), ["status"], null)).status,
    401,
  );
  assert.equal(
    (
      await forward(request("status"), ["status"], {
        ...premium,
        plan: "basic",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await forward(
        request(
          "ask",
          "POST",
          { question: "Hello" },
          { Origin: "https://untrusted.example" },
        ),
        ["ask"],
        premium,
      )
    ).status,
    403,
  );
  assert.equal(
    (await forward(request("upload", "POST"), ["upload"], premium)).status,
    403,
  );
  assert.equal(
    (
      await forward(
        request("documents/report.pdf", "DELETE"),
        ["documents", "report.pdf"],
        premium,
      )
    ).status,
    403,
  );
  assert.equal(calls.length, count);
});

test("proxy exposes only approved paths and rejects traversal or malformed questions", async () => {
  const count = calls.length;
  for (const path of [["tables"], ["http:", "attacker"], ["ask", "extra"]])
    assert.equal(
      (await forward(request(path.join("/")), path, premium)).status,
      404,
    );
  for (const name of ["..", "../report.pdf", "a\\b", "bad\u0000name"])
    assert.equal(
      (
        await forward(request("documents/x", "DELETE"), ["documents", name], {
          ...premium,
          role: "admin",
        })
      ).status,
      400,
    );
  for (const question of ["", " ", 123, "x".repeat(8001)])
    assert.equal(
      (await forward(request("ask", "POST", { question }), ["ask"], premium))
        .status,
      400,
    );
  assert.equal(
    (
      await forward(
        new Request("http://localhost/api/bot/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
        ["ask"],
        premium,
      )
    ).status,
    400,
  );
  assert.equal(calls.length, count);
});

test("proxy supplies its own token, strips cookies and preserves the bot's automatic question flow", async () => {
  const response = await forward(
    request(
      "ask",
      "POST",
      { question: "  Какво пише?  ", route: "SQL", sources: ["private.pdf"] },
      {
        Cookie: "temo-session=browser-cookie",
        "X-TEMO-Service-Token": "forged",
      },
    ),
    ["ask"],
    premium,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, "A cited answer");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const call = calls.at(-1)!;
  assert.equal(call.token, secret);
  assert.equal(call.cookie, undefined);
  assert.deepEqual(JSON.parse(call.body), { question: "Какво пише?" });
});

test("status and error responses do not leak backend configuration or raw errors", async () => {
  const response = await forward(request("status"), ["status"], premium);
  assert.deepEqual(await response.json(), {
    llm_ok: true,
    chunks: 12,
    tables: 2,
  });
  const failure = await forward(
    request("ask", "POST", { question: "upstream failure" }),
    ["ask"],
    premium,
  );
  assert.equal(failure.status, 503);
  assert.doesNotMatch(await failure.text(), /PRIVATE|credentials|server path/);
});

test("missing configuration fails closed without making requests", async () => {
  const count = calls.length;
  for (const url of [
    "",
    "file:///etc/passwd",
    `${origin}/api`,
    "http://username:password@localhost",
  ]) {
    process.env.BOT_SERVICE_URL = url;
    assert.equal(
      (await forward(request("status"), ["status"], premium)).status,
      503,
    );
  }
  process.env.BOT_SERVICE_URL = origin;
  process.env.BOT_SERVICE_TOKEN = "";
  assert.equal(
    (await forward(request("status"), ["status"], premium)).status,
    503,
  );
  process.env.BOT_SERVICE_TOKEN = secret;
  assert.equal(calls.length, count);
});

test("setup diagnostics identify the failed setting for admins without exposing values", async () => {
  const count = calls.length;
  const admin = { ...premium, role: "admin" as const };
  try {
    for (const [url, token, message] of [
      ["", secret, "BOT_SERVICE_URL is missing"],
      [origin, "", "BOT_SERVICE_TOKEN is missing"],
      [origin, "YOUR_EXISTING_BOT_SERVICE_TOKEN", "example placeholder"],
      [origin, "short-private-token", "shorter than 32"],
      [`${origin}/api`, secret, "BOT_SERVICE_URL on the main app is invalid"],
    ]) {
      process.env.BOT_SERVICE_URL = url;
      process.env.BOT_SERVICE_TOKEN = token;
      const response = await forward(request("status"), ["status"], admin);
      assert.equal(response.status, 503);
      const data = await response.json();
      assert.ok(data.error.includes(message));
      assert.ok(!data.error.includes(secret));
      assert.ok(!data.error.includes("short-private-token"));
      const memberResponse = await forward(
        request("status"),
        ["status"],
        premium,
      );
      assert.equal(memberResponse.status, 503);
      assert.doesNotMatch(await memberResponse.text(), /BOT_SERVICE_/);
    }
    assert.equal(calls.length, count);
  } finally {
    process.env.BOT_SERVICE_URL = origin;
    process.env.BOT_SERVICE_TOKEN = secret;
  }
});

test("admin multipart uploads preserve boundaries and enforce the streamed size limit", async () => {
  const admin = { ...premium, role: "admin" as const };
  const form = new FormData();
  form.append(
    "files",
    new File(["country,value\nBG,12"], "market.csv", { type: "text/csv" }),
  );
  const upload = new Request("http://localhost/api/bot/upload", {
    method: "POST",
    body: form,
  });
  const response = await forward(upload, ["upload"], admin);
  assert.equal(response.status, 200);
  assert.match(calls.at(-1)!.contentType!, /multipart\/form-data; boundary=/);
  assert.match(calls.at(-1)!.body, /market.csv/);
  const count = calls.length;
  const large = new Request("http://localhost/api/bot/upload", {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=test" },
    body: new Uint8Array(20 * 1024 * 1024 + 1),
  });
  assert.equal((await forward(large, ["upload"], admin)).status, 413);
  assert.equal(calls.length, count);
});
