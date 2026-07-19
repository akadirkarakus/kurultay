import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { startDraft } from "@/lib/server/draft";
import { ApiError, withApiErrorHandling } from "@/lib/errors";
import { MIN_PLAYERS } from "@/lib/constants";
import { InsufficientCharacterPoolError } from "@/lib/game-logic/allocatePools";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    if (game.host_player_id !== player.id) {
      throw new ApiError(403, "not_host", "Only the host can start the game.");
    }
    if (game.status !== "lobby") {
      throw new ApiError(409, "invalid_state", "The game has already started.");
    }

    const { count: playerCount, error: playersError } = await admin
      .from("game_players")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    if (playersError) throw playersError;
    if ((playerCount ?? 0) < MIN_PLAYERS) {
      throw new ApiError(409, "not_enough_players", `At least ${MIN_PLAYERS} players are required.`);
    }

    try {
      await startDraft(admin, gameId);
    } catch (error) {
      if (error instanceof InsufficientCharacterPoolError) {
        throw new ApiError(409, "not_enough_characters", error.message);
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  },
);
