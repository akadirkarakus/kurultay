import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "kurultay_admin_session";

// Shorter than the 24h game session (lib/session.ts) since this is a
// privileged internal tool, not a per-room player session.
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function setAdminSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export async function readAdminSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
