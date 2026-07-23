import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

function cookieName(gameId: string): string {
  return `ku_session_${gameId}`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Keyed by gameId (not room_code): requirePlayer receives gameId directly
// from the route param, so it can read the session token with zero DB calls
// and fetch the game + player rows in parallel instead of needing a first
// query just to learn the room code to build the cookie name.
export async function setSessionCookie(gameId: string, token: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(gameId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Site-wide path (not scoped to /room/<roomCode>): API routes live under
    // /api/games/..., so a narrower path would never actually be sent there.
    // Distinct games stay isolated from each other via the cookie NAME
    // (which embeds the game id), not via path scoping.
    path: "/",
    maxAge: 60 * 60 * 24, // 24h — long enough to cover a full game plus reconnects
  });
}

export async function readSessionToken(gameId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(cookieName(gameId))?.value ?? null;
}
