import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { startNextRound, startTiebreakRound } from "@/lib/server/rounds";
import { withApiErrorHandling } from "@/lib/errors";
import { ROUND_COUNT } from "@/lib/constants";
import { topScorers } from "@/lib/game-logic/tie";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game } = await requirePlayer(admin, gameId);

    if (game.status !== "round_result") {
      return NextResponse.json({ ok: true }); // another caller already advanced the game
    }

    if (game.current_round < game.max_rounds) {
      await startNextRound(admin, gameId);
      return NextResponse.json({ ok: true });
    }

    const { data: players, error: playersError } = await admin
      .from("game_players")
      .select("id, score")
      .eq("game_id", gameId);
    if (playersError) throw playersError;

    const tied = topScorers((players ?? []).map((p) => ({ playerId: p.id, score: p.score })));

    // A tie-break round is played at most once (§3.4/§8): if the game has
    // already had one and the top scorers are STILL tied, there are no
    // characters left to differentiate them further — declare a shared
    // victory rather than attempting an impossible second tie-break.
    const alreadyHadTiebreak = game.max_rounds > ROUND_COUNT;

    if (tied.length > 1 && !alreadyHadTiebreak) {
      await startTiebreakRound(admin, gameId, tied);
      return NextResponse.json({ ok: true });
    }

    const { error: finishError } = await admin
      .from("games")
      .update({ status: "finished" })
      .eq("id", gameId)
      .eq("status", "round_result");
    if (finishError) throw finishError;

    return NextResponse.json({ ok: true });
  },
);
