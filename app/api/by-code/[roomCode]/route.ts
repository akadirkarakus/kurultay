import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const GET = withApiErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ roomCode: string }> }) => {
    const { roomCode } = await params;
    const admin = supabaseAdmin();

    const { data: game, error } = await admin
      .from("games")
      .select("id, room_code, status")
      .eq("room_code", roomCode.toUpperCase())
      .single();
    if (error || !game) {
      throw new ApiError(404, "room_not_found", "No game found with that room code.");
    }

    return NextResponse.json(game);
  },
);
