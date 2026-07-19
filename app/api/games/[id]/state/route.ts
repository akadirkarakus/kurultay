import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlayer } from "@/lib/server/auth";
import { withApiErrorHandling } from "@/lib/errors";
import { JOKERS, jokerByKey } from "@/lib/jokers";

export const GET = withApiErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id: gameId } = await params;
    const admin = supabaseAdmin();
    const { game, player } = await requirePlayer(admin, gameId);

    const { data: players, error: playersError } = await admin
      .from("game_players_public")
      .select("*")
      .eq("game_id", gameId);
    if (playersError) throw playersError;

    const nicknameById = new Map((players ?? []).map((p) => [p.id, p.nickname]));

    const playersOut = (players ?? []).map((p) => {
      const jokerDef = p.used_joker_key ? jokerByKey(p.used_joker_key) : undefined;
      return {
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        isReady: p.is_ready,
        isHost: p.id === game.host_player_id,
        jokerUsed: p.joker_used,
        usedJoker: jokerDef
          ? {
              key: jokerDef.key,
              name: jokerDef.name,
              targetNickname: p.joker_target_player_id
                ? (nicknameById.get(p.joker_target_player_id) ?? null)
                : null,
            }
          : null,
      };
    });

    let round: unknown = null;
    if (game.current_round > 0) {
      const { data: roundRow, error: roundError } = await admin
        .from("rounds")
        .select("*")
        .eq("game_id", gameId)
        .eq("round_number", game.current_round)
        .maybeSingle();
      if (roundError) throw roundError;

      if (roundRow) {
        const { data: myPickRow } = await admin
          .from("round_picks")
          .select("character_id")
          .eq("round_id", roundRow.id)
          .eq("player_id", player.id)
          .maybeSingle();

        if (roundRow.status === "joker_window") {
          const { data: myDeckCharacters } = await admin
            .from("characters")
            .select("id, name, category, image_url, attributes")
            .in("id", player.deck.length > 0 ? player.deck : ["00000000-0000-0000-0000-000000000000"]);

          const decidedPlayerIds = (players ?? [])
            .filter(
              (p) => p.joker_used || (roundRow.joker_skipped_player_ids ?? []).includes(p.id),
            )
            .map((p) => p.id);

          round = {
            roundNumber: roundRow.round_number,
            scenarioText: roundRow.scenario_text,
            keyAttributes: roundRow.key_attributes,
            status: roundRow.status,
            jokerDeadlineAt: roundRow.joker_deadline_at,
            myJokerAvailable: !player.joker_used,
            myDecidedThisRound:
              player.joker_used || (roundRow.joker_skipped_player_ids ?? []).includes(player.id),
            decidedPlayerIds,
            availableJokers: JOKERS.map((j) => ({
              key: j.key,
              name: j.name,
              description: j.description,
              needsOwnCharacter: j.needsOwnCharacter,
              needsTargetPlayer: j.needsTargetPlayer,
            })),
            myDeck: myDeckCharacters ?? [],
            opponents: (players ?? [])
              .filter((p) => p.id !== player.id)
              .map((p) => ({ id: p.id, nickname: p.nickname })),
          };
        } else if (roundRow.status === "picking") {
          // Secrecy (§3.5): expose *who* has picked, never *what* they picked.
          const { data: pickedRows } = await admin
            .from("round_picks")
            .select("player_id")
            .eq("round_id", roundRow.id);
          round = {
            roundNumber: roundRow.round_number,
            scenarioText: roundRow.scenario_text,
            keyAttributes: roundRow.key_attributes,
            deadlineAt: roundRow.deadline_at,
            status: roundRow.status,
            myPick: myPickRow?.character_id ?? null,
            pickedPlayerIds: (pickedRows ?? []).map((r) => r.player_id),
          };
        } else {
          const { data: picks } = await admin
            .from("round_picks")
            .select("*")
            .eq("round_id", roundRow.id);
          const characterIds = (picks ?? []).map((p) => p.character_id);
          const { data: characters } = await admin
            .from("characters")
            .select("id, name, image_url")
            .in("id", characterIds.length > 0 ? characterIds : ["00000000-0000-0000-0000-000000000000"]);
          const characterById = new Map((characters ?? []).map((c) => [c.id, c]));

          round = {
            roundNumber: roundRow.round_number,
            scenarioText: roundRow.scenario_text,
            keyAttributes: roundRow.key_attributes,
            deadlineAt: roundRow.deadline_at,
            status: roundRow.status,
            myPick: myPickRow?.character_id ?? null,
            picks: (picks ?? []).map((p) => ({
              playerId: p.player_id,
              characterId: p.character_id,
              character: characterById.get(p.character_id) ?? null,
              average: p.average,
              isAutoPick: p.is_auto_pick,
            })),
            winnerCommentary: roundRow.winner_commentary,
            continueDeadlineAt: roundRow.continue_deadline_at,
            continueReadyPlayerIds: roundRow.continue_ready_player_ids,
          };
        }
      }
    }

    let draft: unknown = null;
    if (game.status === "deck_selection") {
      const { data: offerCharacters, error: offerError } = await admin
        .from("characters")
        .select("id, name, category, image_url, attributes")
        .in(
          "id",
          player.draft_offer.length > 0 ? player.draft_offer : ["00000000-0000-0000-0000-000000000000"],
        );
      if (offerError) throw offerError;

      const { data: allPlayers, error: allPlayersError } = await admin
        .from("game_players")
        .select("id, deck")
        .eq("game_id", gameId);
      if (allPlayersError) throw allPlayersError;

      draft = {
        stepNumber: game.current_draft_step,
        totalSteps: game.draft_categories.length,
        category: game.draft_categories[game.current_draft_step - 1] ?? null,
        categories: game.draft_categories,
        deadlineAt: game.draft_deadline_at,
        myOffer: offerCharacters,
        myPicksSoFar: player.deck,
        myPickForCurrentStep: player.deck[game.current_draft_step - 1] ?? null,
        pickedPlayerIds: (allPlayers ?? [])
          .filter((p) => p.deck.length >= game.current_draft_step)
          .map((p) => p.id),
      };
    }

    return NextResponse.json({
      game: {
        id: game.id,
        roomCode: game.room_code,
        status: game.status,
        currentRound: game.current_round,
        maxRounds: game.max_rounds,
      },
      players: playersOut,
      me: {
        id: player.id,
        nickname: player.nickname,
        isHost: player.id === game.host_player_id,
        isReady: player.is_ready,
        deck: player.deck,
        usedCharacters: player.used_characters,
        score: player.score,
      },
      round,
      draft,
    });
  },
);
