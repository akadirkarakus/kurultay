import { shuffle } from "./shuffle";

export class InsufficientCharacterPoolError extends Error {
  constructor(available: number, required: number) {
    super(
      `Not enough characters to start this game: ${available} available, ${required} required.`,
    );
  }
}

/**
 * Splits `characterIds` into one disjoint, non-overlapping chunk per player
 * (§3.7 of the plan) — guarantees no two players can ever be offered, pick,
 * or play the same character within this game.
 */
export function allocateDisjointPools(
  characterIds: readonly string[],
  playerIds: readonly string[],
  poolSizePerPlayer: number,
  rng?: () => number,
): Record<string, string[]> {
  const required = playerIds.length * poolSizePerPlayer;
  if (characterIds.length < required) {
    throw new InsufficientCharacterPoolError(characterIds.length, required);
  }

  const shuffled = shuffle(characterIds, rng);
  const pools: Record<string, string[]> = {};
  playerIds.forEach((playerId, index) => {
    const start = index * poolSizePerPlayer;
    pools[playerId] = shuffled.slice(start, start + poolSizePerPlayer);
  });
  return pools;
}
