import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { closeJokerWindow } from "@/lib/server/jokers";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game } = await requirePlayer(admin, gameId);

    // Already resolved/advanced by another caller — idempotent no-op success.
    if (game.status !== "in_round") {
      return NextResponse.json({ ok: true });
    }

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .select("id, status, joker_deadline_at")
      .eq("game_id", gameId)
      .eq("round_number", game.current_round)
      .single();
    if (roundError || !round) {
      throw new ApiError(404, "round_not_found", "Round not found.");
    }
    if (round.status !== "joker_window") {
      return NextResponse.json({ ok: true });
    }

    // Server-side deadline enforcement, same as /resolve and /draft-resolve.
    if (round.joker_deadline_at && new Date(round.joker_deadline_at).getTime() > Date.now()) {
      throw new ApiError(409, "deadline_not_reached", "The joker window deadline has not been reached yet.");
    }

    await closeJokerWindow(admin, gameId, round.id);
    return NextResponse.json({ ok: true });
  },
);
