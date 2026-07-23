import "server-only";
import { ROUND_DURATION_S } from "@/lib/constants";
import { fillBotRoundPicks } from "@/lib/server/bots";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

export async function anyJokerAvailable(admin: AdminClient, gameId: string): Promise<boolean> {
  const { count } = await admin
    .from("game_players")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("joker_used", false);
  return (count ?? 0) > 0;
}

/**
 * CAS-guarded joker_window -> picking transition (mirrors advanceDraftStep's
 * style): opens the real pick deadline and broadcasts joker_window_closed —
 * this transition never touches `games`, so the client's Postgres-Changes
 * subscription on that table wouldn't otherwise fire.
 */
export async function closeJokerWindow(admin: AdminClient, gameId: string, roundId: string): Promise<void> {
  const deadlineAt = new Date(Date.now() + ROUND_DURATION_S * 1000).toISOString();
  const { data: updated, error } = await admin
    .from("rounds")
    .update({ status: "picking", deadline_at: deadlineAt })
    .eq("id", roundId)
    .eq("status", "joker_window")
    .select("id, key_attributes");
  if (error) throw error;
  if (!updated || updated.length === 0) return; // already closed by another caller

  // Real picking has now opened — bots play their round pick immediately.
  // Must complete (and commit) BEFORE the broadcast below: bot picks don't
  // send their own signal, so a client refetching off this broadcast has to
  // already see them as picked, or it'll never learn otherwise.
  await fillBotRoundPicks(admin, gameId, updated[0]);

  await admin
    .channel(`game:${gameId}`)
    .send({ type: "broadcast", event: "joker_window_closed", payload: {} });
}

/**
 * Closes the joker window early once every player who still had a joker
 * available has either used it or explicitly skipped this round.
 */
export async function maybeCloseJokerWindow(
  admin: AdminClient,
  gameId: string,
  roundId: string,
): Promise<void> {
  // Both queries only need roundId/gameId, not each other's result, so they
  // run concurrently instead of paying two sequential round trips.
  const [{ data: round }, { data: players }] = await Promise.all([
    admin.from("rounds").select("status, joker_skipped_player_ids").eq("id", roundId).single(),
    admin.from("game_players").select("id, joker_used").eq("game_id", gameId),
  ]);
  if (!round || round.status !== "joker_window") return;

  const allDecided = (players ?? []).every(
    (p) => p.joker_used || round.joker_skipped_player_ids.includes(p.id),
  );
  if (allDecided) await closeJokerWindow(admin, gameId, roundId);
}
