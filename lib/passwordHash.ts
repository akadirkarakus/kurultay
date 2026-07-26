import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Deliberately no "server-only" import here (unlike lib/server/adminAuth.ts,
// which re-exports these) — scripts/seed-admin.ts runs outside Next's
// bundler via tsx and would crash on that guard, same reasoning as
// lib/supabase/create-admin-client.ts vs lib/supabase/admin.ts.

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(hashHex, "hex");
  if (derived.length !== storedBuffer.length) return false;
  return timingSafeEqual(derived, storedBuffer);
}

// A syntactically valid but unusable hash, run through the same scrypt cost
// when a login targets a username that doesn't exist — keeps "no such user"
// and "wrong password" taking roughly the same time, so a caller can't use
// response timing to enumerate valid usernames.
const DUMMY_PASSWORD_HASH = `${"00".repeat(16)}:${"00".repeat(KEY_LENGTH)}`;

export async function burnLoginTiming(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_PASSWORD_HASH);
}
