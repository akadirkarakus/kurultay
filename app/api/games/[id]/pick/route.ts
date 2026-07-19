import { NextRequest, NextResponse } from "next/server";
import { submitPickSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { resolveRoundAndBroadcast } from "@/lib/server/rounds";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

// Can transitively trigger up to 2 sequential DeepSeek calls (getWinnerCommentary
// via resolveRoundAndBroadcast), each with its own AI_TIMEOUT_MS — 60s is
// Vercel Hobby's max configurable duration, well above the ~20s worst case.
export const maxDuration = 60;

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const body = submitPickSchema.parse(await req.json());
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    if (game.status !== "in_round") {
      throw new ApiError(409, "invalid_state", "No round is currently open for picks.");
    }
    if (!player.deck.includes(body.characterId)) {
      throw new ApiError(400, "not_in_deck", "That character is not in your deck.");
    }
    if (player.used_characters.includes(body.characterId)) {
      throw new ApiError(400, "character_used", "That character has already been played.");
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
      throw new ApiError(409, "round_closed", "This round is no longer accepting picks.");
    }
    // Cosmetic client countdowns aside, the deadline is enforced here, server-side, against server time.
    if (round.deadline_at && new Date(round.deadline_at).getTime() < Date.now()) {
      throw new ApiError(409, "deadline_passed", "The pick deadline has passed.");
    }

    const { error: insertError } = await admin
      .from("round_picks")
      .insert({ round_id: round.id, player_id: player.id, character_id: body.characterId });
    if (insertError) {
      if (insertError.code === "23505") {
        throw new ApiError(409, "already_picked", "You have already picked for this round.");
      }
      throw insertError;
    }

    // Broadcast only a "someone picked" signal — never the character itself —
    // so opponents get a live checkmark with zero leakage during picking (§3.5).
    await admin
      .channel(`game:${gameId}`)
      .send({ type: "broadcast", event: "pick_submitted", payload: { playerId: player.id } });

    const { count: totalPlayers } = await admin
      .from("game_players")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    const { count: totalPicks } = await admin
      .from("round_picks")
      .select("*", { count: "exact", head: true })
      .eq("round_id", round.id);

    if ((totalPicks ?? 0) >= (totalPlayers ?? 0)) {
      await resolveRoundAndBroadcast(admin, gameId, round.id);
    }

    return NextResponse.json({ ok: true });
  },
);
