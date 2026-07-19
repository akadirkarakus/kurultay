import { NextRequest, NextResponse } from "next/server";
import { joinGameSchema } from "@/lib/validation/schemas";
import { generateSessionToken, setSessionCookie } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";
import { MAX_PLAYERS } from "@/lib/constants";

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = joinGameSchema.parse(await req.json());
  const roomCode = body.roomCode.toUpperCase();
  const admin = supabaseAdmin();

  const { data: game, error: gameError } = await admin
    .from("games")
    .select("*")
    .eq("room_code", roomCode)
    .single();
  if (gameError || !game) {
    throw new ApiError(404, "room_not_found", "No game found with that room code.");
  }
  if (game.status !== "lobby") {
    throw new ApiError(409, "game_already_started", "This game has already started.");
  }

  const { count } = await admin
    .from("game_players")
    .select("*", { count: "exact", head: true })
    .eq("game_id", game.id);
  if ((count ?? 0) >= MAX_PLAYERS) {
    throw new ApiError(409, "room_full", "This room is full.");
  }

  const sessionToken = generateSessionToken();
  const { error: playerError } = await admin
    .from("game_players")
    .insert({ game_id: game.id, nickname: body.nickname, session_token: sessionToken });
  if (playerError) {
    if (playerError.code === "23505") {
      throw new ApiError(409, "nickname_taken", "That nickname is already taken in this room.");
    }
    throw playerError;
  }

  await setSessionCookie(roomCode, sessionToken);

  // game_players has no anon SELECT policy, so Postgres Changes can't reach
  // it — broadcast instead so other lobby clients know to refetch /state.
  await admin.channel(`game:${game.id}`).send({ type: "broadcast", event: "player_updated", payload: {} });

  return NextResponse.json({ gameId: game.id, roomCode });
});
