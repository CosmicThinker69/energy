import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Plan, PublicUser } from "../config";
import { db, query } from "./db";
import { passwordHash, verifyPassword } from "./password";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  company: string;
  plan: Plan;
  status: "active" | "disabled";
  created_at: Date;
};

type Registration = Pick<
  PublicUser,
  "firstName" | "lastName" | "company" | "email"
> & { password: string };

const USER_COLUMNS = `
  u.id, u.email, u.password_hash, u.first_name, u.last_name,
  u.company, u.plan, u.status, u.created_at
`;
const SESSION_SECONDS = 86_400;
const REMEMBER_SECONDS = 30 * 86_400;
const RESET_SECONDS = 15 * 60;

export class DuplicateEmailError extends Error {}
export class InvalidResetTokenError extends Error {}

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

function publicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    plan: row.plan,
    createdAt: row.created_at.toISOString(),
  };
}

export const accountRepository = {
  async authenticate(email: string, password: string) {
    const result = await query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM portal.users u WHERE u.email = $1 LIMIT 1`,
      [normalizeEmail(email)],
    );
    const row = result.rows[0];
    if (!row) {
      // Keep missing-account requests computationally comparable to password checks.
      verifyPassword(password, "0".repeat(32) + ":" + "0".repeat(128));
      return null;
    }
    if (
      !verifyPassword(password, row.password_hash) ||
      row.status !== "active"
    ) {
      return null;
    }
    return publicUser(row);
  },

  async register(input: Registration) {
    try {
      const result = await query<UserRow>(
        `INSERT INTO portal.users
          (id, email, password_hash, first_name, last_name, company, plan, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'basic', 'active')
         RETURNING id, email, password_hash, first_name, last_name, company,
                   plan, status, created_at`,
        [
          randomUUID(),
          normalizeEmail(input.email),
          passwordHash(input.password),
          input.firstName,
          input.lastName,
          input.company,
        ],
      );
      return publicUser(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new DuplicateEmailError(
          "An account with this email already exists. Sign in instead.",
        );
      }
      throw error;
    }
  },

  async createSession(userId: string, remember: boolean) {
    const token = randomBytes(32).toString("base64url");
    const seconds = remember ? REMEMBER_SECONDS : SESSION_SECONDS;
    await query("DELETE FROM portal.sessions WHERE expires_at <= now()");
    await query(
      `INSERT INTO portal.sessions (id, token_hash, user_id, expires_at)
       VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))`,
      [randomUUID(), digest(token), userId, seconds],
    );
    return { token, seconds };
  },

  async getSession(token: string) {
    const tokenHash = digest(token);
    const result = await query<UserRow>(
      `SELECT ${USER_COLUMNS}
       FROM portal.sessions s
       JOIN portal.users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > now()
         AND u.status = 'active'
       LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) {
      await query(
        `DELETE FROM portal.sessions s
         USING portal.users u
         WHERE s.user_id = u.id AND s.token_hash = $1
           AND (s.expires_at <= now() OR u.status <> 'active')`,
        [tokenHash],
      );
      return null;
    }
    void query(
      "UPDATE portal.sessions SET last_seen_at = now() WHERE token_hash = $1",
      [tokenHash],
    ).catch(() => {});
    return publicUser(row);
  },

  async logout(token: string) {
    await query("DELETE FROM portal.sessions WHERE token_hash = $1", [
      digest(token),
    ]);
  },

  async updateProfile(
    userId: string,
    changes: Pick<PublicUser, "firstName" | "lastName" | "company">,
  ) {
    const result = await query<UserRow>(
      `UPDATE portal.users u
       SET first_name = $2, last_name = $3, company = $4, updated_at = now()
       WHERE u.id = $1 AND u.status = 'active'
       RETURNING id, email, password_hash, first_name, last_name, company,
                 plan, status, created_at`,
      [userId, changes.firstName, changes.lastName, changes.company],
    );
    if (!result.rows[0]) throw new Error("Account not found.");
    return publicUser(result.rows[0]);
  },

  async createResetToken(email: string) {
    const result = await query<{ id: string; email: string }>(
      "SELECT id, email FROM portal.users WHERE email = $1 AND status = 'active' LIMIT 1",
      [normalizeEmail(email)],
    );
    const user = result.rows[0];
    if (!user) return null;
    const token = randomBytes(32).toString("base64url");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM portal.password_reset_tokens WHERE user_id = $1 OR expires_at <= now()",
        [user.id],
      );
      await client.query(
        `INSERT INTO portal.password_reset_tokens
          (id, token_hash, user_id, expires_at)
         VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))`,
        [randomUUID(), digest(token), user.id, RESET_SECONDS],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { token, email: user.email };
  },

  async resetPassword(token: string, password: string) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id
         FROM portal.password_reset_tokens
         WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL
         FOR UPDATE`,
        [digest(token)],
      );
      const reset = result.rows[0];
      if (!reset) {
        throw new InvalidResetTokenError(
          "This reset link has expired or has already been used. Request a new one.",
        );
      }
      await client.query(
        "UPDATE portal.password_reset_tokens SET used_at = now() WHERE id = $1",
        [reset.id],
      );
      await client.query(
        "UPDATE portal.users SET password_hash = $2, updated_at = now() WHERE id = $1",
        [reset.user_id, passwordHash(password)],
      );
      await client.query("DELETE FROM portal.sessions WHERE user_id = $1", [
        reset.user_id,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
