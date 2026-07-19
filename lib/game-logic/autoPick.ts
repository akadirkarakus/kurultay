/**
 * Chooses a random not-yet-used character from a player's deck. Returns
 * null if every character in the deck has already been used (shouldn't
 * happen in a normal round, but callers should handle it defensively).
 */
export function pickAutoCharacter(
  deck: readonly string[],
  usedCharacters: readonly string[],
  rng: () => number = Math.random,
): string | null {
  const used = new Set(usedCharacters);
  const candidates = deck.filter((id) => !used.has(id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}
