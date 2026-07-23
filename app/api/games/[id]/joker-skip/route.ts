import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { maybeCloseJokerWindow } from "@/lib/server/jokers";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    // Already past the joker window — idempotent no-op success, not an
    // error, so racing client timers/clicks never see a failure.
    if (game.status !== "in_round") {
      return NextResponse.json({ ok: true });
    }

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .select("id, status")
      .eq("game_id", gameId)
      .eq("round_number", game.current_round)
      .single();
    if (roundError || !round) {
      throw new ApiError(404, "round_not_found", "Round not found.");
    }
    if (round.status !== "joker_window") {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.rpc("skip_joker", { p_round_id: round.id, p_player_id: player.id });
    if (error) throw error;

    // Independent of the window-close check below, so they run concurrently.
    await Promise.all([
      admin
        .channel(`game:${gameId}`)
        .send({ type: "broadcast", event: "joker_skipped", payload: { playerId: player.id } }),
      maybeCloseJokerWindow(admin, gameId, round.id),
    ]);

    return NextResponse.json({ ok: true });
  },
);
