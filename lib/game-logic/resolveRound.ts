import { JOKER_VALUE_MODIFIER } from "@/lib/constants";

export interface RoundPickInput {
  playerId: string;
  characterId: string;
  /** The character's full attribute map (battle attributes only). */
  attributes: Record<string, number>;
  /** True if this pick's card was boosted by the value_boost joker. */
  boosted?: boolean;
  /** True if this pick's card was debuffed by the value_debuff joker. */
  debuffed?: boolean;
}

export interface RoundPickResult {
  playerId: string;
  characterId: string;
  average: number;
  isWinner: boolean;
}

/**
 * Pure mirror of the resolve_round Postgres function's scoring math
 * (supabase/migrations/0002_functions.sql) — kept here so the averaging,
 * tie, and winner-selection logic has a fast, DB-free unit test suite.
 */
export function computeRoundResult(
  picks: readonly RoundPickInput[],
  keyAttributes: readonly string[],
): RoundPickResult[] {
  const withAverages = picks.map((pick) => {
    const sum = keyAttributes.reduce((total, attr) => {
      const value = pick.attributes[attr];
      if (typeof value !== "number") {
        throw new Error(`Character ${pick.characterId} is missing attribute "${attr}".`);
      }
      return total + value;
    }, 0);
    let average = sum / keyAttributes.length;
    if (pick.boosted) average *= 1 + JOKER_VALUE_MODIFIER;
    if (pick.debuffed) average *= 1 - JOKER_VALUE_MODIFIER;
    return { ...pick, average };
  });

  const maxAverage = Math.max(...withAverages.map((p) => p.average));

  return withAverages.map((pick) => ({
    playerId: pick.playerId,
    characterId: pick.characterId,
    average: pick.average,
    isWinner: pick.average === maxAverage,
  }));
}
