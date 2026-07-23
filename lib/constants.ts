export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const DECK_SIZE = 5;

/** Characters offered to each player per category step in the draft. */
export const DRAFT_OFFER_SIZE = 5;
/** Seconds each category-draft step stays open before stragglers are auto-picked. */
export const DRAFT_STEP_DURATION_S = 30;

export const ROUND_COUNT = 4;
export const ROUND_DURATION_S = 30;
/** Seconds the round-result screen waits for every player to click "Devam et" before auto-advancing. */
export const CONTINUE_WINDOW_S = 45;
export const KEY_ATTRIBUTES_PER_ROUND = 5;

/** Seconds a round's joker window stays open before auto-closing into normal picking. */
export const JOKER_WINDOW_DURATION_S = 20;
/** +/-8% attribute modifier applied by value_boost/value_debuff jokers at score time. */
export const JOKER_VALUE_MODIFIER = 0.08;

export const AI_TIMEOUT_MS = 6_000;

export const ROOM_CODE_LENGTH = 6;
/** Excludes 0/O/1/I/L to avoid visual ambiguity when players read codes aloud or type them. */
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Fixed nicknames for the 2 AI bots seated in single-player mode. */
export const BOT_NICKNAMES = ["Atlas", "Zeynep"] as const;
