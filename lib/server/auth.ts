import "server-only";
import { ApiError } from "@/lib/errors";
import { readSessionToken } from "@/lib/session";
import type { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof supabaseAdmin>;
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];

/**
 * Resolves the caller's identity for a given game from its per-room session
 * cookie. Every mutation route calls this first — there is no other
 * authorization mechanism in this no-auth MVP (see Kurultay-steps.md NOTES).
 */
export async function requirePlayer(
  admin: AdminClient,
  gameId: string,
): Promise<{ game: GameRow; player: GamePlayerRow }> {
  // Cookie is keyed by gameId (see lib/session.ts), which is already known
  // from the route param — no DB round trip needed to find it, so the game
  // and player rows below can be fetched in parallel instead of the game row
  // needing to resolve first just to learn the room code.
  const token = await readSessionToken(gameId);
  if (!token) {
    throw new ApiError(401, "not_authenticated", "No session found for this room.");
  }

  const [{ data: game, error: gameError }, { data: player, error: playerError }] = await Promise.all([
    admin.from("games").select("*").eq("id", gameId).single(),
    admin.from("game_players").select("*").eq("game_id", gameId).eq("session_token", token).single(),
  ]);
  if (gameError || !game) {
    throw new ApiError(404, "game_not_found", "Game not found.");
  }
  if (playerError || !player) {
    throw new ApiError(401, "not_authenticated", "Invalid session for this room.");
  }

  return { game, player };
}
