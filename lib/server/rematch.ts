import "server-only";
import { pickDraftCategories } from "@/lib/game-logic/draftCategories";
import { DRAFT_STEP_DURATION_S, ROUND_COUNT } from "@/lib/constants";
import { fillBotDraftPicks } from "@/lib/server/bots";
import { dealCategoryOffers } from "@/lib/server/draft";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Resets a finished game back into a fresh deck_selection phase, in place:
 * same room code, same game_players rows (and therefore same session
 * cookies) — no new game or room is created. Wipes rounds (cascades
 * round_picks) and per-player round/joker/deck state, then deals
 * category-1 offers exactly like startDraft does for a brand-new game
 * leaving the lobby.
 *
 * Guarded by rematch_started_at (see migration 0013) so concurrent callers
 * — e.g. the last two players' "ready" clicks landing back-to-back — can't
 * both run this and deal two different random category sets into the same
 * game. Only the caller whose claim UPDATE actually flips it from null
 * proceeds; the rest are silent no-ops.
 */
export async function startRematch(admin: AdminClient, gameId: string): Promise<void> {
  const { data: claimed, error: claimError } = await admin
    .from("games")
    .update({ rematch_started_at: new Date().toISOString() })
    .eq("id", gameId)
    .eq("status", "finished")
    .is("rematch_started_at", null)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return;

  const { error: deleteRoundsError } = await admin.from("rounds").delete().eq("game_id", gameId);
  if (deleteRoundsError) throw deleteRoundsError;

  const { error: resetPlayersError } = await admin
    .from("game_players")
    .update({
      score: 0,
      deck: [],
      used_characters: [],
      joker_used: false,
      used_joker_key: null,
      joker_own_character_id: null,
      joker_target_player_id: null,
      debuffed_character_ids: [],
    })
    .eq("game_id", gameId);
  if (resetPlayersError) throw resetPlayersError;

  const categories = pickDraftCategories();
  const offers = await dealCategoryOffers(admin, gameId, categories[0]);
  // Each update touches a distinct player row, so they run concurrently
  // instead of one sequential round trip per player.
  await Promise.all(
    Object.entries(offers).map(async ([playerId, offer]) => {
      const { error } = await admin.from("game_players").update({ draft_offer: offer }).eq("id", playerId);
      if (error) throw error;
    }),
  );

  const deadline = new Date(Date.now() + DRAFT_STEP_DURATION_S * 1000).toISOString();
  const { error: gameError } = await admin
    .from("games")
    .update({
      status: "deck_selection",
      current_round: 0,
      max_rounds: ROUND_COUNT,
      draft_categories: categories,
      current_draft_step: 1,
      draft_deadline_at: deadline,
      rematch_ready_player_ids: [],
      rematch_started_at: null,
    })
    .eq("id", gameId);
  if (gameError) throw gameError;

  await fillBotDraftPicks(admin, gameId, 1);
}

/** Shared "if everyone has now clicked 'Yeniden Oyna', start the rematch" check. */
export async function maybeStartRematch(admin: AdminClient, gameId: string): Promise<void> {
  // Both queries only need gameId, not each other's result, so they run
  // concurrently instead of paying two sequential round trips.
  const [{ data: game }, { data: players }] = await Promise.all([
    admin.from("games").select("rematch_ready_player_ids").eq("id", gameId).single(),
    admin.from("game_players").select("id").eq("game_id", gameId),
  ]);
  if (!game) return;

  const allReady =
    (players ?? []).length > 0 &&
    (players ?? []).every((p) => game.rematch_ready_player_ids.includes(p.id));

  if (allReady) await startRematch(admin, gameId);
}
