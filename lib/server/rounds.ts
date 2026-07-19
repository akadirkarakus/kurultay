import "server-only";
import { getKeyAttributes, getWinnerCommentary } from "@/lib/ai";
import { CONTINUE_WINDOW_S, JOKER_WINDOW_DURATION_S, ROUND_COUNT, ROUND_DURATION_S } from "@/lib/constants";
import { computeRoundResult } from "@/lib/game-logic/resolveRound";
import { topScorers } from "@/lib/game-logic/tie";
import { anyJokerAvailable } from "@/lib/server/jokers";
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
 * Starts the next normal round. Safe to call from multiple concurrent
 * requests: the unique (game_id, round_number) constraint on `rounds` means
 * only the first insert wins — a conflict is treated as "another caller
 * already started this round," not an error.
 *
 * If any player still has an unused joker, the round opens in a
 * `joker_window` phase instead of straight into `picking` (§ Sprint 10) —
 * no pick deadline is set until the joker window closes
 * (lib/server/jokers.ts closeJokerWindow).
 */
export async function startNextRound(admin: AdminClient, gameId: string): Promise<void> {
  const { data: game, error: gameError } = await admin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !game) throw new Error(`Game ${gameId} not found.`);

  const nextRoundNumber = game.current_round + 1;
  const scenario = await pickUnusedScenario(admin, gameId);
  const keyAttributes = await getKeyAttributes(scenario.text, scenario.suggested_attributes);

  const jokerAvailable = await anyJokerAvailable(admin, gameId);
  const now = Date.now();
  const status = jokerAvailable ? "joker_window" : "picking";
  const deadlineAt = jokerAvailable ? null : new Date(now + ROUND_DURATION_S * 1000).toISOString();
  const jokerDeadlineAt = jokerAvailable
    ? new Date(now + JOKER_WINDOW_DURATION_S * 1000).toISOString()
    : null;

  const { error: insertError } = await admin.from("rounds").insert({
    game_id: gameId,
    round_number: nextRoundNumber,
    scenario_text: scenario.text,
    key_attributes: keyAttributes,
    deadline_at: deadlineAt,
    status,
    joker_deadline_at: jokerDeadlineAt,
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

  // Opens the round-result "Devam et" window the moment results become
  // visible. CAS-guarded so a redundant broadcastRoundResolved call (another
  // caller already resolved this round) never pushes the deadline back out.
  if (round && round.continue_deadline_at === null) {
    const continueDeadline = new Date(Date.now() + CONTINUE_WINDOW_S * 1000).toISOString();
    await admin
      .from("rounds")
      .update({ continue_deadline_at: continueDeadline })
      .eq("id", roundId)
      .is("continue_deadline_at", null);
  }

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
    const { data: players } = await admin
      .from("game_players")
      .select("id, nickname, used_joker_key, joker_own_character_id, debuffed_character_ids")
      .eq("game_id", gameId);
    const playerById = new Map((players ?? []).map((p) => [p.id, p.nickname]));
    const jokerInfoById = new Map((players ?? []).map((p) => [p.id, p]));

    const scored = computeRoundResult(
      picks.map((p) => {
        const jokerInfo = jokerInfoById.get(p.player_id);
        return {
          playerId: p.player_id,
          characterId: p.character_id,
          attributes: (characterById.get(p.character_id)?.attributes ?? {}) as Record<string, number>,
          boosted:
            jokerInfo?.used_joker_key === "value_boost" &&
            jokerInfo?.joker_own_character_id === p.character_id,
          debuffed: jokerInfo?.debuffed_character_ids?.includes(p.character_id) ?? false,
        };
      }),
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

/**
 * Advances the game out of round_result: next round, tie-break, or finished.
 * Shared by /continue (the 45s-deadline fallback) and /continue-ready (once
 * every player has clicked "Devam et") — see maybeAdvanceAfterRoundResult.
 * Idempotent: a game no longer in round_result is a silent no-op, so both
 * callers can race harmlessly.
 */
export async function advanceRoundResult(admin: AdminClient, gameId: string): Promise<void> {
  const { data: game, error: gameError } = await admin.from("games").select("*").eq("id", gameId).single();
  if (gameError || !game) throw new Error(`Game ${gameId} not found.`);

  if (game.status !== "round_result") return; // another caller already advanced

  if (game.current_round < game.max_rounds) {
    await startNextRound(admin, gameId);
    return;
  }

  const { data: players, error: playersError } = await admin
    .from("game_players")
    .select("id, score")
    .eq("game_id", gameId);
  if (playersError) throw playersError;

  const tied = topScorers((players ?? []).map((p) => ({ playerId: p.id, score: p.score })));

  // A tie-break round is played at most once: if the game has already had
  // one and the top scorers are STILL tied, there are no characters left to
  // differentiate them further — declare a shared victory instead of
  // attempting an impossible second tie-break.
  const alreadyHadTiebreak = game.max_rounds > ROUND_COUNT;

  if (tied.length > 1 && !alreadyHadTiebreak) {
    await startTiebreakRound(admin, gameId, tied);
    return;
  }

  const { error: finishError } = await admin
    .from("games")
    .update({ status: "finished" })
    .eq("id", gameId)
    .eq("status", "round_result");
  if (finishError) throw finishError;
}

/**
 * Checks whether every current player has clicked "Devam et" for the given
 * round and, if so, advances immediately rather than waiting out the full
 * CONTINUE_WINDOW_S. Mirrors maybeAdvanceDraftStep's shape.
 */
export async function maybeAdvanceAfterRoundResult(
  admin: AdminClient,
  gameId: string,
  roundId: string,
): Promise<void> {
  const { data: round } = await admin
    .from("rounds")
    .select("continue_ready_player_ids")
    .eq("id", roundId)
    .single();
  if (!round) return;

  const { data: players } = await admin.from("game_players").select("id").eq("game_id", gameId);
  const allReady =
    (players ?? []).length > 0 &&
    (players ?? []).every((p) => round.continue_ready_player_ids.includes(p.id));

  if (allReady) await advanceRoundResult(admin, gameId);
}
