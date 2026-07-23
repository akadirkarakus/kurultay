import { BATTLE_ATTRIBUTE_KEYS } from "@/lib/attributes";

export interface AttributedCharacter {
  id: string;
  attributes: Record<string, number>;
}

function averageAcross(character: AttributedCharacter, attributeKeys: readonly string[]): number {
  const sum = attributeKeys.reduce((total, attr) => {
    const value = character.attributes[attr];
    if (typeof value !== "number") {
      throw new Error(`Character ${character.id} is missing attribute "${attr}".`);
    }
    return total + value;
  }, 0);
  return sum / attributeKeys.length;
}

function pickArgmax(
  candidates: readonly AttributedCharacter[],
  attributeKeys: readonly string[],
  rng: () => number,
): string {
  if (candidates.length === 0) {
    throw new Error("pickArgmax requires at least one candidate.");
  }
  const scored = candidates.map((c) => ({ id: c.id, average: averageAcross(c, attributeKeys) }));
  const maxAverage = Math.max(...scored.map((s) => s.average));
  const best = scored.filter((s) => s.average === maxAverage);
  return best[Math.floor(rng() * best.length)].id;
}

/**
 * Bot draft-pick strategy: a round's key attributes aren't chosen until
 * that round starts (long after the whole draft finishes), so a bot can't
 * optimize for a specific future round — it picks the character with the
 * highest overall average across every battle attribute instead.
 */
export function pickBestDraftCharacter(
  offer: readonly AttributedCharacter[],
  rng: () => number = Math.random,
): string {
  return pickArgmax(offer, BATTLE_ATTRIBUTE_KEYS, rng);
}

/**
 * Bot round-pick strategy: a round's key attributes are already known and
 * visible to every player before picking (round.keyAttributes), so a bot
 * can directly maximize the same average resolve_round will score it on —
 * mirrors computeRoundResult's averaging shape (lib/game-logic/resolveRound.ts).
 */
export function pickBestRoundCharacter(
  unusedDeck: readonly AttributedCharacter[],
  keyAttributes: readonly string[],
  rng: () => number = Math.random,
): string {
  return pickArgmax(unusedDeck, keyAttributes, rng);
}
