import "server-only";
import { allocateDisjointPools } from "@/lib/game-logic/allocatePools";
import { pickDraftCategories } from "@/lib/game-logic/draftCategories";
import { DECK_SIZE, DRAFT_OFFER_SIZE, DRAFT_STEP_DURATION_S } from "@/lib/constants";
import { startNextRound } from "@/lib/server/rounds";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

async function dealCategoryOffers(
  admin: AdminClient,
  gameId: string,
  category: string,
): Promise<Record<string, string[]>> {
  const { data: players } = await admin.from("game_players").select("id").eq("game_id", gameId);
  const { data: characters } = await admin.from("characters").select("id").eq("category", category);
  return allocateDisjointPools(
    (characters ?? []).map((c) => c.id),
    (players ?? []).map((p) => p.id),
    DRAFT_OFFER_SIZE,
  ); // throws InsufficientCharacterPoolError — caller maps it to an ApiError
}

/**
 * Picks the 5 categories for this game and deals category-1 offers. Called
 * from /api/games/[id]/start in place of the old whole-pool allocation.
 */
export async function startDraft(admin: AdminClient, gameId: string): Promise<void> {
  const categories = pickDraftCategories();
  const offers = await dealCategoryOffers(admin, gameId, categories[0]);

  for (const [playerId, offer] of Object.entries(offers)) {
    const { error } = await admin
      .from("game_players")
      .update({ draft_offer: offer, deck: [] })
      .eq("id", playerId);
    if (error) throw error;
  }

  const deadline = new Date(Date.now() + DRAFT_STEP_DURATION_S * 1000).toISOString();
  const { error } = await admin
    .from("games")
    .update({
      status: "deck_selection",
      draft_categories: categories,
      current_draft_step: 1,
      draft_deadline_at: deadline,
    })
    .eq("id", gameId)
    .eq("status", "lobby");
  if (error) throw error;
}

/**
 * Advances to the next category step (dealing fresh disjoint offers), or —
 * once all DECK_SIZE categories are done — starts round 1 via the existing
 * (already idempotent) startNextRound. CAS-guarded exactly like the
 * conditional-update pattern already used in /start and /continue: only the
 * first caller to see current_draft_step still at the old value deals
 * offers and bumps the counter.
 */
export async function advanceDraftStep(admin: AdminClient, gameId: string): Promise<void> {
  const { data: game, error: gameError } = await admin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !game) throw new Error(`Game ${gameId} not found.`);

  const nextStep = game.current_draft_step + 1;
  if (nextStep > DECK_SIZE) {
    await startNextRound(admin, gameId);
    return;
  }

  const category = game.draft_categories[nextStep - 1];
  const offers = await dealCategoryOffers(admin, gameId, category);
  const deadline = new Date(Date.now() + DRAFT_STEP_DURATION_S * 1000).toISOString();

  const { data: updated, error: updateError } = await admin
    .from("games")
    .update({ current_draft_step: nextStep, draft_deadline_at: deadline })
    .eq("id", gameId)
    .eq("current_draft_step", nextStep - 1)
    .select("id");
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) return; // another caller already advanced

  for (const [playerId, offer] of Object.entries(offers)) {
    const { error } = await admin.from("game_players").update({ draft_offer: offer }).eq("id", playerId);
    if (error) throw error;
  }
}

/**
 * For any player who hasn't picked for the current step, auto-picks a
 * random character from their own draft_offer — mirrors resolve_round's
 * auto-pick philosophy, simpler here since offers are already disjoint per
 * step (no "used characters" exclusion needed).
 */
export async function autoFillDraftStragglers(admin: AdminClient, gameId: string): Promise<void> {
  const { data: game } = await admin.from("games").select("*").eq("id", gameId).single();
  if (!game || game.status !== "deck_selection") return;

  const { data: players } = await admin.from("game_players").select("*").eq("game_id", gameId);
  for (const player of players ?? []) {
    if (player.deck.length < game.current_draft_step && player.draft_offer.length > 0) {
      const choice = player.draft_offer[Math.floor(Math.random() * player.draft_offer.length)];
      await admin.rpc("submit_draft_pick", {
        p_player_id: player.id,
        p_step_number: game.current_draft_step,
        p_character_id: choice,
      });
    }
  }
}

/** Shared "if everyone has now picked for the current step, advance" check. */
export async function maybeAdvanceDraftStep(admin: AdminClient, gameId: string): Promise<void> {
  const { data: game } = await admin.from("games").select("*").eq("id", gameId).single();
  if (!game || game.status !== "deck_selection") return;

  const { data: players } = await admin.from("game_players").select("deck").eq("game_id", gameId);
  const allPicked = (players ?? []).every((p) => p.deck.length >= game.current_draft_step);
  if (allPicked) await advanceDraftStep(admin, gameId);
}
