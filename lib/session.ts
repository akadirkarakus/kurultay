import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

function cookieName(roomCode: string): string {
  return `ku_session_${roomCode.toUpperCase()}`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function setSessionCookie(roomCode: string, token: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(roomCode), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Site-wide path (not scoped to /room/<roomCode>): API routes live under
    // /api/games/..., so a narrower path would never actually be sent there.
    // Distinct games stay isolated from each other via the cookie NAME
    // (which embeds the room code), not via path scoping.
    path: "/",
    maxAge: 60 * 60 * 24, // 24h — long enough to cover a full game plus reconnects
  });
}

export async function readSessionToken(roomCode: string): Promise<string | null> {
  const store = await cookies();
  return store.get(cookieName(roomCode))?.value ?? null;
}
