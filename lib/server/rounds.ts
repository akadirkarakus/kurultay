import "server-only";
import { getKeyAttributes, getWinnerCommentary } from "@/lib/ai";
import { ROUND_DURATION_S } from "@/lib/constants";
import { computeRoundResult } from "@/lib/game-logic/resolveRound";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

async function pickUnusedScenario(admin: AdminClient, gameId: string) {
  const { data: usedRounds } = await admin.from("rounds").select("scenario_text").eq("game_id", gameId);
  const usedTexts = new Set((usedRounds ?? []).map((r) => r.scenario_text));

  const { data: allScenarios, error } = await admin.from("scenarios").select("*");
  if (error || !allScenarios || allScenarios.length === 0) {
    throw new Error("No scenarios available — run `npm run seed:scenarios` first.");
  }

  const unused = allScenarios.filter((s) => !usedTexts.has(s.text));
  const pool = unused.length > 0 ? unused : allScenarios; // reuse if a game somehow outlasts the pool
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Starts the next normal (picking-phase) round. Safe to call from multiple
 * concurrent requests: the unique (game_id, round_number) constraint on
 * `rounds` means only the first insert wins — a conflict is treated as
 * "another caller already started this round," not an error.
 */
export async function startNextRound(admin: AdminClient, gameId: string): Promise<void> {
  const { data: game, error: gameError } = await admin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !game) throw new Error(`Game ${gameId} not found.`);

  const nextRoundNumber = game.current_round + 1;
  const scenario = await pickUnusedScenario(admin, gameId);
  const keyAttributes = await getKeyAttributes(scenario.text, scenario.suggested_attributes);
  const deadlineAt = new Date(Date.now() + ROUND_DURATION_S * 1000).toISOString();

  const { error: insertError } = await admin.from("rounds").insert({
    game_id: gameId,
    round_number: nextRoundNumber,
    scenario_text: scenario.text,
    key_attributes: keyAttributes,
    deadline_at: deadlineAt,
    status: "picking",
  });

  if (insertError) {
    if (insertError.code === "23505") return; // another caller already started this round
    throw insertError;
  }

  const { error: updateError } = await admin
    .from("games")
    .update({ status: "in_round", current_round: nextRoundNumber })
    .eq("id", gameId);
  if (updateError) throw updateError;
}

/**
 * Starts and immediately resolves the tie-break round (§3.4): no picking
 * phase, only the tied players participate, each auto-playing their single
 * remaining character. Bumps max_rounds so the "N of max_rounds" display
 * stays consistent.
 */
export async function startTiebreakRound(
  admin: AdminClient,
  gameId: string,
  tiedPlayerIds: string[],
): Promise<void> {
  const { data: game, error: gameError } = await admin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !game) throw new Error(`Game ${gameId} not found.`);

  const nextRoundNumber = game.current_round + 1;
  const scenario = await pickUnusedScenario(admin, gameId);
  const keyAttributes = await getKeyAttributes(scenario.text, scenario.suggested_attributes);

  const { data: round, error: insertError } = await admin
    .from("rounds")
    .insert({
      game_id: gameId,
      round_number: nextRoundNumber,
      scenario_text: scenario.text,
      key_attributes: keyAttributes,
      deadline_at: null,
      status: "picking",
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") return;
    throw insertError;
  }

  const { error: updateError } = await admin
    .from("games")
    .update({ status: "in_round", current_round: nextRoundNumber, max_rounds: nextRoundNumber })
    .eq("id", gameId);
  if (updateError) throw updateError;

  const { error: rpcError } = await admin.rpc("resolve_tiebreak_round", {
    p_round_id: round.id,
    p_tied_player_ids: tiedPlayerIds,
  });
  if (rpcError) throw rpcError;

  await broadcastRoundResolved(admin, gameId, round.id);
}

/**
 * Calls the resolve_round RPC (idempotent — see supabase/migrations/0002_functions.sql)
 * and broadcasts the full reveal. Safe to call redundantly: a round already
 * resolved by another caller just results in an unchanged re-broadcast of
 * the same (already-committed) result.
 */
export async function resolveRoundAndBroadcast(
  admin: AdminClient,
  gameId: string,
  roundId: string,
): Promise<void> {
  const { error: rpcError } = await admin.rpc("resolve_round", { p_round_id: roundId });
  if (rpcError) throw rpcError;
  await broadcastRoundResolved(admin, gameId, roundId);
}

async function broadcastRoundResolved(admin: AdminClient, gameId: string, roundId: string): Promise<void> {
  const { data: round, error: roundError } = await admin.from("rounds").select("*").eq("id", roundId).single();
  if (roundError) throw roundError;

  const { data: picks, error: picksError } = await admin
    .from("round_picks")
    .select("*")
    .eq("round_id", roundId);
  if (picksError) throw picksError;

  const characterIds = (picks ?? []).map((p) => p.character_id);
  const { data: characters, error: charactersError } = await admin
    .from("characters")
    .select("id, name, image_url, attributes")
    .in("id", characterIds.length > 0 ? characterIds : ["00000000-0000-0000-0000-000000000000"]);
  if (charactersError) throw charactersError;
  const characterById = new Map((characters ?? []).map((c) => [c.id, c]));

  if (round && round.winner_commentary === null && picks && picks.length > 0) {
    const { data: players } = await admin.from("game_players").select("id, nickname").eq("game_id", gameId);
    const playerById = new Map((players ?? []).map((p) => [p.id, p.nickname]));

    const scored = computeRoundResult(
      picks.map((p) => ({
        playerId: p.player_id,
        characterId: p.character_id,
        attributes: (characterById.get(p.character_id)?.attributes ?? {}) as Record<string, number>,
      })),
      round.key_attributes,
    );
    const commentaryPicks = scored.map((s) => ({
      characterName: characterById.get(s.characterId)?.name ?? "?",
      playerNickname: playerById.get(s.playerId) ?? "?",
      average: s.average,
      isWinner: s.isWinner,
      isAutoPick: picks.find((p) => p.player_id === s.playerId)?.is_auto_pick ?? false,
    }));

    const commentary = await getWinnerCommentary(round.scenario_text, round.key_attributes, commentaryPicks);
    // CAS guard: if a concurrent caller already wrote one, don't overwrite it.
    await admin
      .from("rounds")
      .update({ winner_commentary: commentary })
      .eq("id", roundId)
      .is("winner_commentary", null);
  }

  const payload = (picks ?? []).map((p) => ({
    playerId: p.player_id,
    characterId: p.character_id,
    character: characterById.get(p.character_id) ?? null,
    average: p.average,
    isAutoPick: p.is_auto_pick,
  }));

  await admin.channel(`game:${gameId}`).send({
    type: "broadcast",
    event: "round_resolved",
    payload: { picks: payload },
  });
}
