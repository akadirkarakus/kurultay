import { describe, expect, it } from "vitest";
import { JOKER_KEYS, JOKERS, isJokerKey, jokerByKey } from "@/lib/jokers";

describe("joker catalog", () => {
  it("covers every key in JOKER_KEYS exactly once", () => {
    expect(JOKERS.map((j) => j.key).sort()).toEqual([...JOKER_KEYS].sort());
    expect(new Set(JOKERS.map((j) => j.key)).size).toBe(JOKERS.length);
  });

  it("gives every joker a non-empty name and description", () => {
    for (const joker of JOKERS) {
      expect(joker.name.trim().length).toBeGreaterThan(0);
      expect(joker.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("isJokerKey accepts catalog keys and rejects unknown strings", () => {
    for (const key of JOKER_KEYS) {
      expect(isJokerKey(key)).toBe(true);
    }
    expect(isJokerKey("not_a_real_joker")).toBe(false);
  });

  it("jokerByKey resolves a known key and returns undefined for an unknown one", () => {
    expect(jokerByKey("card_swap")?.key).toBe("card_swap");
    expect(jokerByKey("not_a_real_joker")).toBeUndefined();
  });
});
