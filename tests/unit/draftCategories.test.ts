import { describe, expect, it } from "vitest";
import { pickDraftCategories } from "@/lib/game-logic/draftCategories";
import { CHARACTER_CATEGORIES } from "@/lib/categories";

describe("pickDraftCategories", () => {
  it("returns exactly `count` unique categories by default (DECK_SIZE)", () => {
    const result = pickDraftCategories();
    expect(result).toHaveLength(5);
    expect(new Set(result).size).toBe(5);
    for (const category of result) {
      expect(CHARACTER_CATEGORIES).toContain(category);
    }
  });

  it("respects an explicit count", () => {
    expect(pickDraftCategories(CHARACTER_CATEGORIES, 3)).toHaveLength(3);
    expect(pickDraftCategories(CHARACTER_CATEGORIES, 9)).toHaveLength(9);
  });

  it("is deterministic given an injected rng", () => {
    const rng = () => 0;
    const a = pickDraftCategories(CHARACTER_CATEGORIES, 5, rng);
    const b = pickDraftCategories(CHARACTER_CATEGORIES, 5, rng);
    expect(a).toEqual(b);
  });

  it("never returns duplicate categories even across many trials", () => {
    for (let i = 0; i < 20; i++) {
      const result = pickDraftCategories();
      expect(new Set(result).size).toBe(result.length);
    }
  });
});
