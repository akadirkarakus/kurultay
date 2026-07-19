import { describe, expect, it } from "vitest";
import { computeRoundResult } from "@/lib/game-logic/resolveRound";

const KEY_ATTRS = ["intelligence", "physical_endurance", "mental_strength"];

describe("computeRoundResult", () => {
  it("declares a single clear winner", () => {
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: { intelligence: 90, physical_endurance: 80, mental_strength: 85 } },
        { playerId: "p2", characterId: "c2", attributes: { intelligence: 40, physical_endurance: 30, mental_strength: 35 } },
      ],
      KEY_ATTRS,
    );
    expect(result.find((r) => r.playerId === "p1")?.isWinner).toBe(true);
    expect(result.find((r) => r.playerId === "p2")?.isWinner).toBe(false);
    expect(result.find((r) => r.playerId === "p1")?.average).toBeCloseTo(85, 5);
  });

  it("declares a 2-way tie when two players match exactly", () => {
    const attrs = { intelligence: 60, physical_endurance: 60, mental_strength: 60 };
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: attrs },
        { playerId: "p2", characterId: "c2", attributes: attrs },
        { playerId: "p3", characterId: "c3", attributes: { intelligence: 10, physical_endurance: 10, mental_strength: 10 } },
      ],
      KEY_ATTRS,
    );
    expect(result.filter((r) => r.isWinner).map((r) => r.playerId).sort()).toEqual(["p1", "p2"]);
  });

  it("declares a 3-way (all-players) tie giving everyone the point", () => {
    const attrs = { intelligence: 50, physical_endurance: 50, mental_strength: 50 };
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: attrs },
        { playerId: "p2", characterId: "c2", attributes: attrs },
        { playerId: "p3", characterId: "c3", attributes: attrs },
      ],
      KEY_ATTRS,
    );
    expect(result.every((r) => r.isWinner)).toBe(true);
  });

  it("handles a fully auto-picked round the same as a manually picked one", () => {
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: { intelligence: 20, physical_endurance: 90, mental_strength: 10 } },
        { playerId: "p2", characterId: "c2", attributes: { intelligence: 20, physical_endurance: 10, mental_strength: 10 } },
      ],
      KEY_ATTRS,
    );
    expect(result.find((r) => r.playerId === "p1")?.isWinner).toBe(true);
  });

  it("throws if a character is missing one of the key attributes", () => {
    expect(() =>
      computeRoundResult(
        [{ playerId: "p1", characterId: "c1", attributes: { intelligence: 50 } }],
        KEY_ATTRS,
      ),
    ).toThrow(/missing attribute/);
  });
});
