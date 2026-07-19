import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { autoFillDraftStragglers, maybeAdvanceDraftStep } from "@/lib/server/draft";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game } = await requirePlayer(admin, gameId);

    // Already resolved/advanced by another caller — idempotent no-op success.
    if (game.status !== "deck_selection") {
      return NextResponse.json({ ok: true });
    }

    if (game.draft_deadline_at && new Date(game.draft_deadline_at).getTime() > Date.now()) {
      throw new ApiError(409, "deadline_not_reached", "The draft deadline has not been reached yet.");
    }

    await autoFillDraftStragglers(admin, gameId);
    await maybeAdvanceDraftStep(admin, gameId);

    return NextResponse.json({ ok: true });
  },
);
