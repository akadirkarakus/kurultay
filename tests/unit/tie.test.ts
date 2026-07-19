import { describe, expect, it } from "vitest";
import { isOverallTie, topScorers } from "@/lib/game-logic/tie";

describe("topScorers", () => {
  it("returns the single leader when there is no tie", () => {
    expect(
      topScorers([
        { playerId: "a", score: 3 },
        { playerId: "b", score: 2 },
      ]),
    ).toEqual(["a"]);
  });

  it("returns all players sharing the top score", () => {
    const result = topScorers([
      { playerId: "a", score: 2 },
      { playerId: "b", score: 2 },
      { playerId: "c", score: 1 },
    ]);
    expect(new Set(result)).toEqual(new Set(["a", "b"]));
  });

  it("returns all players when every player (2, 3, or 4) ties", () => {
    for (const count of [2, 3, 4]) {
      const players = Array.from({ length: count }, (_, i) => ({ playerId: `p${i}`, score: 5 }));
      expect(topScorers(players)).toHaveLength(count);
    }
  });
});

describe("isOverallTie", () => {
  it("is false with a unique leader", () => {
    expect(isOverallTie([{ playerId: "a", score: 3 }, { playerId: "b", score: 1 }])).toBe(false);
  });

  it("is true when two or more players share the top score", () => {
    expect(isOverallTie([{ playerId: "a", score: 2 }, { playerId: "b", score: 2 }])).toBe(true);
  });
});
