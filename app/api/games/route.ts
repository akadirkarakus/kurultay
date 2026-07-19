import { NextRequest, NextResponse } from "next/server";
import { createGameSchema } from "@/lib/validation/schemas";
import { insertWithUniqueRoomCode } from "@/lib/room-code";
import { generateSessionToken, setSessionCookie } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = createGameSchema.parse(await req.json());
  const admin = supabaseAdmin();

  const game = await insertWithUniqueRoomCode(async (roomCode) => {
    const { data, error } = await admin.from("games").insert({ room_code: roomCode }).select().single();
    if (error) {
      if (error.code === "23505") return null; // room_code conflict — regenerate and retry
      throw error;
    }
    return data;
  });

  const sessionToken = generateSessionToken();
  const { data: player, error: playerError } = await admin
    .from("game_players")
    .insert({ game_id: game.id, nickname: body.nickname, session_token: sessionToken })
    .select()
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await admin
    .from("games")
    .update({ host_player_id: player.id })
    .eq("id", game.id);
  if (hostError) throw hostError;

  await setSessionCookie(game.room_code, sessionToken);

  return NextResponse.json({ gameId: game.id, roomCode: game.room_code });
});
