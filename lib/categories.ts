/**
 * The 9 character categories, matching CATEGORY_BY_SHEET in
 * scripts/import-characters.ts — the single source of truth for what
 * categories exist, used by the category draft (lib/game-logic/draftCategories.ts).
 */
export const CHARACTER_CATEGORIES = [
  "politician",
  "historical",
  "actor",
  "movie_character",
  "tv_character",
  "internet_celebrity",
  "athlete",
  "artist",
  "celebrity",
] as const;

export type CharacterCategory = (typeof CHARACTER_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CharacterCategory, string> = {
  politician: "Siyasetçiler",
  historical: "Tarihi Kişilikler",
  actor: "Oyuncular",
  movie_character: "Film Karakterleri",
  tv_character: "Dizi Karakterleri",
  internet_celebrity: "İnternet Ünlüleri",
  athlete: "Sporcular",
  artist: "Sanatçılar",
  celebrity: "Ünlüler",
};

export function isCharacterCategory(value: string): value is CharacterCategory {
  return (CHARACTER_CATEGORIES as readonly string[]).includes(value);
}
