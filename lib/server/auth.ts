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
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();
  if (gameError || !game) {
    throw new ApiError(404, "game_not_found", "Game not found.");
  }

  const token = await readSessionToken(game.room_code);
  if (!token) {
    throw new ApiError(401, "not_authenticated", "No session found for this room.");
  }

  const { data: player, error: playerError } = await admin
    .from("game_players")
    .select("*")
    .eq("game_id", gameId)
    .eq("session_token", token)
    .single();
  if (playerError || !player) {
    throw new ApiError(401, "not_authenticated", "Invalid session for this room.");
  }

  return { game, player };
}
