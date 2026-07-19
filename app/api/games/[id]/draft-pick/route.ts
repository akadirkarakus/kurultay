import { NextRequest, NextResponse } from "next/server";
import { submitDraftPickSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { maybeAdvanceDraftStep } from "@/lib/server/draft";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

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
    await admin
      .channel(`game:${gameId}`)
      .send({ type: "broadcast", event: "draft_pick_submitted", payload: { playerId: player.id } });

    await maybeAdvanceDraftStep(admin, gameId);

    return NextResponse.json({ ok: true });
  },
);
