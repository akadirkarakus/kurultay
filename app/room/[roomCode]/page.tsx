import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GameClient } from "./GameClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  const admin = supabaseAdmin();

  const { data: game } = await admin
    .from("games")
    .select("id, room_code")
    .eq("room_code", roomCode.toUpperCase())
    .maybeSingle();

  if (!game) notFound();

  return <GameClient gameId={game.id} roomCode={game.room_code} />;
}
