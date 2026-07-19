import { describe, expect, it } from "vitest";
import { pickAutoCharacter } from "@/lib/game-logic/autoPick";

describe("pickAutoCharacter", () => {
  it("picks from deck characters that are not yet used", () => {
    const result = pickAutoCharacter(["a", "b", "c"], ["a"], () => 0);
    expect(result).toBe("b"); // first remaining candidate with rng()=0
  });

  it("never returns an already-used character", () => {
    for (let i = 0; i < 20; i++) {
      const result = pickAutoCharacter(["a", "b", "c", "d"], ["a", "c"], Math.random);
      expect(["b", "d"]).toContain(result);
    }
  });

  it("returns null when the whole deck is used up", () => {
    expect(pickAutoCharacter(["a", "b"], ["a", "b"])).toBeNull();
  });

  it("is deterministic for the tie-break case (exactly one candidate)", () => {
    expect(pickAutoCharacter(["a", "b", "c"], ["a", "b"], () => 0.99)).toBe("c");
  });
});
