import { NextRequest, NextResponse } from "next/server";
import { submitDraftPickSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { maybeAdvanceDraftStep } from "@/lib/server/draft";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

// maybeAdvanceDraftStep can transitively call startNextRound -> getKeyAttributes
// (up to 2 sequential DeepSeek calls, each bounded by AI_TIMEOUT_MS) once the
// last category step is picked — ~12s worst case; 60s is Vercel Hobby's max
// configurable duration, kept as a generous ceiling.
export const maxDuration = 60;

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const body = submitDraftPickSchema.parse(await req.json());
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    if (game.status !== "deck_selection") {
      throw new ApiError(409, "invalid_state", "Not in the deck selection phase.");
    }
    if (!player.draft_offer.includes(body.characterId)) {
      throw new ApiError(400, "character_not_offered", "That character was not offered to you this step.");
    }

    const { data: accepted, error } = await admin.rpc("submit_draft_pick", {
      p_player_id: player.id,
      p_step_number: game.current_draft_step,
      p_character_id: body.characterId,
    });
    if (error) throw error;
    if (!accepted) {
      throw new ApiError(409, "already_picked", "You have already picked for this category.");
    }

    // Broadcast only a "someone picked" signal — never the character itself —
    // mirroring pick_submitted's secrecy-preserving pattern for round picks.
    // Independent of the step-advance check below, so they run concurrently.
    await Promise.all([
      admin
        .channel(`game:${gameId}`)
        .send({ type: "broadcast", event: "draft_pick_submitted", payload: { playerId: player.id } }),
      maybeAdvanceDraftStep(admin, gameId),
    ]);

    return NextResponse.json({ ok: true });
  },
);
