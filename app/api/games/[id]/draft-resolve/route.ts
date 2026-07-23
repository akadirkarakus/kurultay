import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { autoFillDraftStragglers, maybeAdvanceDraftStep } from "@/lib/server/draft";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

// maybeAdvanceDraftStep can transitively call startNextRound -> getKeyAttributes
// (up to 2 sequential DeepSeek calls, each bounded by AI_TIMEOUT_MS) once the
// last category step is picked — ~12s worst case; 60s is Vercel Hobby's max
// configurable duration, kept as a generous ceiling.
export const maxDuration = 60;

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
