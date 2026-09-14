import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { canAccess } from "../src/lib/config";

loadEnvConfig(process.cwd());

const email = `auth-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

let accountRepository: (typeof import("../src/lib/server/repository"))["accountRepository"];
let DuplicateEmailError: (typeof import("../src/lib/server/repository"))["DuplicateEmailError"];
let InvalidResetTokenError: (typeof import("../src/lib/server/repository"))["InvalidResetTokenError"];
let query: (typeof import("../src/lib/server/db"))["query"];
let db: (typeof import("../src/lib/server/db"))["db"];

before(async () => {
  ({ accountRepository, DuplicateEmailError, InvalidResetTokenError } =
    await import("../src/lib/server/repository"));
  ({ query, db } = await import("../src/lib/server/db"));
});

after(async () => {
  await query("DELETE FROM portal.users WHERE email = $1", [email]);
  await db.end();
});

test("PostgreSQL accounts, sessions, plans, status, and reset tokens", async () => {
  const registered = await accountRepository.register({
    firstName: "Taylor",
    lastName: "Reed",
    company: "North Grid",
    email: email.toUpperCase(),
    password: "Secure123!",
  });
  assert.equal(registered.email, email);
  assert.equal(registered.plan, "basic");
  assert.equal(registered.role, "user");
  assert.equal("password_hash" in registered, false);

  await assert.rejects(
    accountRepository.register({
      firstName: "Duplicate",
      lastName: "User",
      company: "North Grid",
      email,
      password: "Secure123!",
    }),
    DuplicateEmailError,
  );
  assert.equal(
    (await accountRepository.authenticate(email, "Secure123!"))?.id,
    registered.id,
  );
  assert.equal(await accountRepository.authenticate(email, "Wrong123!"), null);

  const remembered = await accountRepository.createSession(registered.id, true);
  assert.equal(remembered.seconds, 30 * 86_400);
  const storedSession = await query<{
    token_hash: string;
    expires_at: Date;
  }>("SELECT token_hash, expires_at FROM portal.sessions WHERE user_id = $1", [
    registered.id,
  ]);
  assert.equal(storedSession.rows[0].token_hash.length, 64);
  assert.notEqual(storedSession.rows[0].token_hash, remembered.token);
  assert.ok(
    storedSession.rows[0].expires_at.getTime() > Date.now() + 29 * 86_400_000,
  );
  assert.equal(
    (await accountRepository.getSession(remembered.token))?.plan,
    "basic",
  );

  await query(
    "UPDATE portal.users SET plan = 'professional', updated_at = now() WHERE id = $1",
    [registered.id],
  );
  const upgraded = await accountRepository.getSession(remembered.token);
  assert.equal(upgraded?.plan, "professional");
  assert.equal(canAccess(upgraded!.plan, "explorer"), true);
  assert.equal(canAccess(upgraded!.plan, "reports"), false);

  await query("UPDATE portal.users SET status = 'disabled' WHERE id = $1", [
    registered.id,
  ]);
  assert.equal(await accountRepository.getSession(remembered.token), null);
  assert.equal(await accountRepository.authenticate(email, "Secure123!"), null);
  await query("UPDATE portal.users SET status = 'active' WHERE id = $1", [
    registered.id,
  ]);

  const oldSession = await accountRepository.createSession(
    registered.id,
    false,
  );
  assert.equal(oldSession.seconds, 86_400);
  const reset = await accountRepository.createResetToken(email);
  assert.ok(reset);
  const storedReset = await query<{ token_hash: string }>(
    "SELECT token_hash FROM portal.password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
    [registered.id],
  );
  assert.equal(storedReset.rows[0].token_hash.length, 64);
  assert.notEqual(storedReset.rows[0].token_hash, reset!.token);

  await accountRepository.resetPassword(reset!.token, "Changed123!");
  assert.equal(await accountRepository.getSession(oldSession.token), null);
  assert.equal(await accountRepository.authenticate(email, "Secure123!"), null);
  assert.equal(
    (await accountRepository.authenticate(email, "Changed123!"))?.id,
    registered.id,
  );
  await assert.rejects(
    accountRepository.resetPassword(reset!.token, "Again123!"),
    InvalidResetTokenError,
  );

  const logoutSession = await accountRepository.createSession(
    registered.id,
    false,
  );
  await accountRepository.logout(logoutSession.token);
  assert.equal(await accountRepository.getSession(logoutSession.token), null);
});
