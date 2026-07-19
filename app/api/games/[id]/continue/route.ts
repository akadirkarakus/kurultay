import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { advanceRoundResult } from "@/lib/server/rounds";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

// advanceRoundResult can transitively call startNextRound/startTiebreakRound
// -> getKeyAttributes, and broadcastRoundResolved -> getWinnerCommentary (tie-break
// path resolves+broadcasts in the same call) — up to 2 sequential DeepSeek chains,
// each up to ~20s worst case. 60s is Vercel Hobby's max configurable duration.
export const maxDuration = 60;

// Safety-net fallback for CONTINUE_WINDOW_S: the room's client-side countdowns
// call this once their local deadline elapses, in case /continue-ready's
// all-players-ready path didn't already advance the game.
export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game } = await requirePlayer(admin, gameId);

    if (game.status !== "round_result") {
      return NextResponse.json({ ok: true }); // another caller already advanced the game
    }

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .select("continue_deadline_at")
      .eq("game_id", gameId)
      .eq("round_number", game.current_round)
      .single();
    if (roundError || !round) {
      throw new ApiError(404, "round_not_found", "Round not found.");
    }

    // Server-side deadline enforcement, same as /resolve and /draft-resolve —
    // a client can only reach this early by lying about the clock, and this
    // check stops it: real advancement before the deadline only happens via
    // /continue-ready once every player has clicked "Devam et".
    if (round.continue_deadline_at && new Date(round.continue_deadline_at).getTime() > Date.now()) {
      throw new ApiError(409, "deadline_not_reached", "The continue deadline has not been reached yet.");
    }

    await advanceRoundResult(admin, gameId);
    return NextResponse.json({ ok: true });
  },
);
