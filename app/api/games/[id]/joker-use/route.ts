import { NextRequest, NextResponse } from "next/server";
import { useJokerSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { maybeCloseJokerWindow } from "@/lib/server/jokers";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const body = useJokerSchema.parse(await req.json());
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    if (game.status !== "in_round") {
      throw new ApiError(409, "invalid_state", "No round is currently open.");
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
      throw new ApiError(409, "joker_window_closed", "The joker window is closed for this round.");
    }

    const { data: result, error } = await admin.rpc("use_joker", {
      p_round_id: round.id,
      p_player_id: player.id,
      p_joker_key: body.jokerKey,
      p_own_character_id: body.ownCharacterId ?? null,
      p_target_player_id: body.targetPlayerId ?? null,
    });
    if (error) throw error;
    if (result === null) {
      throw new ApiError(409, "joker_unavailable", "That joker could not be used.");
    }

    // Broadcast only a "someone used a joker" signal — the reveal of who used
    // what against whom comes from /state (game_players_public), matching the
    // pick_submitted secrecy-preserving pattern used elsewhere. Independent
    // of the window-close check below, so they run concurrently.
    await Promise.all([
      admin
        .channel(`game:${gameId}`)
        .send({ type: "broadcast", event: "joker_used", payload: { playerId: player.id } }),
      maybeCloseJokerWindow(admin, gameId, round.id),
    ]);

    return NextResponse.json({ ok: true });
  },
);
