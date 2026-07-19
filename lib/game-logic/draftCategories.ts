import { shuffle } from "./shuffle";
import { CHARACTER_CATEGORIES, type CharacterCategory } from "@/lib/categories";
import { DECK_SIZE } from "@/lib/constants";

/** Picks `count` categories uniformly at random, without replacement, in draft order. */
export function pickDraftCategories(
  categories: readonly CharacterCategory[] = CHARACTER_CATEGORIES,
  count: number = DECK_SIZE,
  rng?: () => number,
): CharacterCategory[] {
  return shuffle(categories, rng).slice(0, count);
}
