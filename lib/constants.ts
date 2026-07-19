export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const DECK_SIZE = 5;

/** Characters offered to each player per category step in the draft. */
export const DRAFT_OFFER_SIZE = 5;
/** Seconds each category-draft step stays open before stragglers are auto-picked. */
export const DRAFT_STEP_DURATION_S = 30;

export const ROUND_COUNT = 4;
export const ROUND_DURATION_S = 30;
export const RESULT_DISPLAY_S = 8;
export const KEY_ATTRIBUTES_PER_ROUND = 5;

export const AI_TIMEOUT_MS = 10_000;

export const ROOM_CODE_LENGTH = 6;
/** Excludes 0/O/1/I/L to avoid visual ambiguity when players read codes aloud or type them. */
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
