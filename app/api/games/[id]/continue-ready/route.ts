import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { maybeAdvanceAfterRoundResult } from "@/lib/server/rounds";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

// maybeAdvanceAfterRoundResult can trigger the same advanceRoundResult chain
// as /continue (getKeyAttributes only, ~12s worst case — see that route's
// comment). 60s is Vercel Hobby's max configurable duration, kept as a
// generous ceiling for background commentary work triggered along the way.
export const maxDuration = 60;

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    if (game.status !== "round_result") {
      throw new ApiError(409, "invalid_state", "Not in the round-result phase.");
    }

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .select("id")
      .eq("game_id", gameId)
      .eq("round_number", game.current_round)
      .single();
    if (roundError || !round) {
      throw new ApiError(404, "round_not_found", "Round not found.");
    }

    const { data: marked, error } = await admin.rpc("mark_continue_ready", {
      p_round_id: round.id,
      p_player_id: player.id,
    });
    if (error) throw error;

    if (marked) {
      // Independent of the advance check below, so they run concurrently.
      // If it does advance, startNextRound/startTiebreakRound update the
      // games row, which every client already watches via postgres_changes —
      // so a client that refetches off this broadcast before that lands just
      // self-corrects on the next signal.
      await Promise.all([
        admin
          .channel(`game:${gameId}`)
          .send({ type: "broadcast", event: "continue_ready_submitted", payload: { playerId: player.id } }),
        maybeAdvanceAfterRoundResult(admin, gameId, round.id),
      ]);
    }

    return NextResponse.json({ ok: true });
  },
);
