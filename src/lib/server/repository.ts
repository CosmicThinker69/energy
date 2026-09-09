import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import type { Plan, PublicUser } from "../config";

type Account = PublicUser & { passwordHash: string };
type Session = { userId: string; expires: number };
type Store = {
  users: Account[];
  sessions: Record<string, Session>;
  resets: Record<string, Session>;
};
const directory = process.env.TEMO_DATA_DIR || join(process.cwd(), ".data");
const path = join(directory, "accounts.json");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verify(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    scryptSync(password, salt, 64),
  );
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function write(store: Store) {
  mkdirSync(directory, { recursive: true });
  const temp = path + ".tmp";
  writeFileSync(temp, JSON.stringify(store, null, 2));
  renameSync(temp, path);
}
function read(): Store {
  if (!existsSync(path)) {
    write({
      users: (["basic", "professional", "premium"] as Plan[]).map(
        (plan, i) => ({
          id: `demo-${plan}`,
          firstName: ["Alex", "Alex", "Alex"][i],
          lastName: "Morgan",
          company: "Meridian Energy",
          email: `${plan}@demo.com`,
          plan,
          createdAt: "2026-08-12T09:00:00.000Z",
          passwordHash: passwordHash("Demo123!"),
        }),
      ),
      sessions: {},
      resets: {},
    });
  }
  return JSON.parse(readFileSync(path, "utf8"));
}
export function publicUser(user: Account): PublicUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}
export const accountRepository = {
  authenticate(email: string, password: string) {
    const user = read().users.find(
      (u) => u.email === email.toLowerCase().trim(),
    );
    return user && verify(password, user.passwordHash)
      ? publicUser(user)
      : null;
  },
  register(input: Omit<PublicUser, "id" | "createdAt"> & { password: string }) {
    const store = read();
    if (store.users.some((u) => u.email === input.email.toLowerCase().trim()))
      throw new Error(
        "An account with this email already exists. Sign in instead.",
      );
    const { password, ...profile } = input;
    const account: Account = {
      ...profile,
      email: input.email.toLowerCase().trim(),
      id: randomBytes(12).toString("hex"),
      createdAt: new Date().toISOString(),
      passwordHash: passwordHash(password),
    };
    store.users.push(account);
    write(store);
    return publicUser(account);
  },
  createSession(userId: string, remember: boolean) {
    const store = read();
    const token = randomBytes(32).toString("hex");
    const seconds = remember ? 30 * 86400 : 86400;
    for (const [k, v] of Object.entries(store.sessions))
      if (v.expires < Date.now()) delete store.sessions[k];
    store.sessions[digest(token)] = {
      userId,
      expires: Date.now() + seconds * 1000,
    };
    write(store);
    return { token, seconds };
  },
  getSession(token: string) {
    const store = read();
    const session = store.sessions[digest(token)];
    if (!session || session.expires < Date.now()) return null;
    const user = store.users.find((u) => u.id === session.userId);
    return user ? publicUser(user) : null;
  },
  logout(token: string) {
    const store = read();
    delete store.sessions[digest(token)];
    write(store);
  },
  update(
    userId: string,
    changes: Partial<
      Pick<PublicUser, "firstName" | "lastName" | "company" | "plan">
    >,
  ) {
    const store = read();
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error("Account not found.");
    Object.assign(user, changes);
    write(store);
    return publicUser(user);
  },
  resetToken(email: string) {
    const store = read();
    const user = store.users.find(
      (u) => u.email === email.toLowerCase().trim(),
    );
    if (!user) return null;
    const token = randomBytes(32).toString("hex");
    for (const [k, v] of Object.entries(store.resets))
      if (v.userId === user.id || v.expires < Date.now())
        delete store.resets[k];
    store.resets[digest(token)] = {
      userId: user.id,
      expires: Date.now() + 15 * 60000,
    };
    write(store);
    return token;
  },
  resetPassword(token: string, password: string) {
    const store = read();
    const reset = store.resets[digest(token)];
    if (!reset || reset.expires < Date.now())
      throw new Error("This reset link has expired. Request a new one.");
    const user = store.users.find((u) => u.id === reset.userId)!;
    user.passwordHash = passwordHash(password);
    delete store.resets[digest(token)];
    for (const [k, v] of Object.entries(store.sessions))
      if (v.userId === user.id) delete store.sessions[k];
    write(store);
  },
};
