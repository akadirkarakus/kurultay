import "server-only";
import { BOT_NICKNAMES } from "@/lib/constants";
import { pickBestDraftCharacter, pickBestRoundCharacter } from "@/lib/game-logic/botStrategy";
import { generateSessionToken } from "@/lib/session";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * All functions here only ever touch game_players rows with is_bot = true,
 * so they're a no-op (single empty-array select) for ordinary multiplayer
 * games. Bots have no browser/session cookie — every decision here is
 * written directly with the admin client from inside the human's own
 * request, via the exact same RPCs/inserts a human's own route would use.
 */

/** Seats the 2 AI bots for a freshly created single-player game. */
export async function createBotPlayers(admin: AdminClient, gameId: string): Promise<void> {
  const { error } = await admin.from("game_players").insert(
    BOT_NICKNAMES.map((nickname) => ({
      game_id: gameId,
      nickname,
      session_token: generateSessionToken(),
      is_bot: true,
    })),
  );
  if (error) throw error;
}

async function fetchCharacterAttributes(
  admin: AdminClient,
  characterIds: readonly string[],
): Promise<Map<string, Record<string, number>>> {
  if (characterIds.length === 0) return new Map();
  const { data, error } = await admin.from("characters").select("id, attributes").in("id", characterIds);
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, c.attributes as Record<string, number>]));
}

/** For every bot who hasn't picked yet for the given draft step, picks the strongest offered character. */
export async function fillBotDraftPicks(admin: AdminClient, gameId: string, stepNumber: number): Promise<void> {
  const { data: bots, error } = await admin
    .from("game_players")
    .select("id, draft_offer, deck")
    .eq("game_id", gameId)
    .eq("is_bot", true);
  if (error) throw error;

  const acting = (bots ?? []).filter((bot) => bot.deck.length < stepNumber && bot.draft_offer.length > 0);
  if (acting.length === 0) return;

  // One attribute query across every acting bot's combined offer, instead of
  // one per bot, then each bot's pick+RPC runs concurrently since bots never
  // touch each other's rows.
  const attributesById = await fetchCharacterAttributes(
    admin,
    [...new Set(acting.flatMap((bot) => bot.draft_offer))],
  );

  await Promise.all(
    acting.map((bot) => {
      const offer = bot.draft_offer.map((id) => ({ id, attributes: attributesById.get(id) ?? {} }));
      const choice = pickBestDraftCharacter(offer);
      return admin.rpc("submit_draft_pick", {
        p_player_id: bot.id,
        p_step_number: stepNumber,
        p_character_id: choice,
      });
    }),
  );
}

/** For every bot without a round_picks row yet this round, plays the best-fit unused character. */
export async function fillBotRoundPicks(
  admin: AdminClient,
  gameId: string,
  round: { id: string; key_attributes: string[] },
): Promise<void> {
  const { data: bots, error: botsError } = await admin
    .from("game_players")
    .select("id, deck, used_characters")
    .eq("game_id", gameId)
    .eq("is_bot", true);
  if (botsError) throw botsError;
  if (!bots || bots.length === 0) return;

  const { data: existingPicks, error: picksError } = await admin
    .from("round_picks")
    .select("player_id")
    .eq("round_id", round.id);
  if (picksError) throw picksError;
  const alreadyPicked = new Set((existingPicks ?? []).map((p) => p.player_id));

  const acting = bots
    .filter((bot) => !alreadyPicked.has(bot.id))
    .map((bot) => ({ bot, unused: bot.deck.filter((id) => !bot.used_characters.includes(id)) }))
    .filter(({ unused }) => unused.length > 0);
  if (acting.length === 0) return;

  // One attribute query across every acting bot's combined unused deck,
  // instead of one per bot, then each bot's pick+insert runs concurrently.
  const attributesById = await fetchCharacterAttributes(
    admin,
    [...new Set(acting.flatMap(({ unused }) => unused))],
  );

  await Promise.all(
    acting.map(async ({ bot, unused }) => {
      const candidates = unused.map((id) => ({ id, attributes: attributesById.get(id) ?? {} }));
      const choice = pickBestRoundCharacter(candidates, round.key_attributes);

      const { error } = await admin
        .from("round_picks")
        .insert({ round_id: round.id, player_id: bot.id, character_id: choice });
      // 23505 just means another caller already recorded this bot's pick — harmless.
      if (error && error.code !== "23505") throw error;
    }),
  );
}

/** For every bot still holding an unused joker, skips it for this round. */
export async function fillBotJokerDecisions(admin: AdminClient, gameId: string, roundId: string): Promise<void> {
  const { data: bots, error } = await admin
    .from("game_players")
    .select("id")
    .eq("game_id", gameId)
    .eq("is_bot", true)
    .eq("joker_used", false);
  if (error) throw error;

  await Promise.all(
    (bots ?? []).map((bot) => admin.rpc("skip_joker", { p_round_id: roundId, p_player_id: bot.id })),
  );
}

/** Marks every bot ready to continue past the round-result screen. */
export async function markBotsContinueReady(admin: AdminClient, gameId: string, roundId: string): Promise<void> {
  const { data: bots, error } = await admin
    .from("game_players")
    .select("id")
    .eq("game_id", gameId)
    .eq("is_bot", true);
  if (error) throw error;

  await Promise.all(
    (bots ?? []).map((bot) => admin.rpc("mark_continue_ready", { p_round_id: roundId, p_player_id: bot.id })),
  );
}

/** Marks every bot ready for a rematch once the game has finished. */
export async function markBotsRematchReady(admin: AdminClient, gameId: string): Promise<void> {
  const { data: bots, error } = await admin
    .from("game_players")
    .select("id")
    .eq("game_id", gameId)
    .eq("is_bot", true);
  if (error) throw error;

  await Promise.all(
    (bots ?? []).map((bot) => admin.rpc("mark_rematch_ready", { p_game_id: gameId, p_player_id: bot.id })),
  );
}
