import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { maybeStartRematch } from "@/lib/server/rematch";
import { ApiError, withApiErrorHandling } from "@/lib/errors";
import { InsufficientCharacterPoolError } from "@/lib/game-logic/allocatePools";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    if (game.status !== "finished") {
      throw new ApiError(409, "invalid_state", "Not in the finished phase.");
    }

    const { data: marked, error } = await admin.rpc("mark_rematch_ready", {
      p_game_id: gameId,
      p_player_id: player.id,
    });
    if (error) throw error;

    if (marked) {
      try {
        await maybeStartRematch(admin, gameId);
      } catch (err) {
        if (err instanceof InsufficientCharacterPoolError) {
          throw new ApiError(409, "not_enough_characters", err.message);
        }
        throw err;
      }
    }

    return NextResponse.json({ ok: true });
  },
);
