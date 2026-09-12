import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string) {
  try {
    const [salt, keyHex, extra] = encoded.split(":");
    if (
      extra !== undefined ||
      !/^[a-f0-9]{32}$/i.test(salt) ||
      !/^[a-f0-9]{128}$/i.test(keyHex)
    ) {
      return false;
    }
    const expected = Buffer.from(keyHex, "hex");
    return timingSafeEqual(
      expected,
      scryptSync(password, salt, expected.length),
    );
  } catch {
    return false;
  }
}
