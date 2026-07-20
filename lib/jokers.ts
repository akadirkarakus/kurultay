export const JOKER_KEYS = ["card_swap", "value_boost", "value_debuff"] as const;
export type JokerKey = (typeof JOKER_KEYS)[number];

export interface JokerDefinition {
  key: JokerKey;
  name: string;
  description: string;
  imageUrl: string;
  needsOwnCharacter: boolean;
  needsTargetPlayer: boolean;
}

/**
 * The joker catalog — currently 3 of ~10 planned. Adding a new joker means:
 * add an entry here, add a matching branch in the use_joker Postgres
 * function (supabase/migrations/0010_jokers.sql), and reseed via
 * `npm run seed:jokers`.
 */
export const JOKERS: readonly JokerDefinition[] = [
  {
    key: "card_swap",
    name: "Kart Çalma",
    description: "Destenden bir kart seç; rakibinin rastgele bir kartıyla takas edilsin.",
    imageUrl: "/jokers/card-swap.png",
    needsOwnCharacter: true,
    needsTargetPlayer: true,
  },
  {
    key: "value_boost",
    name: "Değer Artırma",
    description: "Destenden bir kart seç; o kart oynandığında tüm özellikleri %8 artsın.",
    imageUrl: "/jokers/value-boost.png",
    needsOwnCharacter: true,
    needsTargetPlayer: false,
  },
  {
    key: "value_debuff",
    name: "Değer Düşürme",
    description: "Bir rakip seç; rastgele bir kartının tüm özellikleri %8 düşsün.",
    imageUrl: "/jokers/value-debuff.png",
    needsOwnCharacter: false,
    needsTargetPlayer: true,
  },
];

export function isJokerKey(value: string): value is JokerKey {
  return (JOKER_KEYS as readonly string[]).includes(value);
}

export function jokerByKey(key: string): JokerDefinition | undefined {
  return JOKERS.find((j) => j.key === key);
}
