import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { resolveRoundAndBroadcast } from "@/lib/server/rounds";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game } = await requirePlayer(admin, gameId);

    // Already resolved/advanced by another caller — idempotent no-op success,
    // not an error, so racing client timers never see a failure.
    if (game.status !== "in_round") {
      return NextResponse.json({ ok: true });
    }

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .select("*")
      .eq("game_id", gameId)
      .eq("round_number", game.current_round)
      .single();
    if (roundError || !round) {
      throw new ApiError(404, "round_not_found", "Round not found.");
    }
    if (round.status !== "picking") {
      return NextResponse.json({ ok: true });
    }

    // Server-side deadline enforcement — a client can trigger this early
    // only if it's lying about the clock, and this check stops it cold.
    if (round.deadline_at && new Date(round.deadline_at).getTime() > Date.now()) {
      throw new ApiError(409, "deadline_not_reached", "The pick deadline has not been reached yet.");
    }

    await resolveRoundAndBroadcast(admin, gameId, round.id);
    return NextResponse.json({ ok: true });
  },
);
