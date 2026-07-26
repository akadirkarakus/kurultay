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

  it("applies the value_boost joker's +8% modifier to the boosted pick's average", () => {
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: { intelligence: 60, physical_endurance: 60, mental_strength: 60 }, boosted: true },
        { playerId: "p2", characterId: "c2", attributes: { intelligence: 63, physical_endurance: 63, mental_strength: 63 } },
      ],
      KEY_ATTRS,
    );
    // 60 * 1.08 = 64.8, beats p2's unmodified 63 average.
    expect(result.find((r) => r.playerId === "p1")?.average).toBeCloseTo(64.8, 5);
    expect(result.find((r) => r.playerId === "p1")?.isWinner).toBe(true);
    expect(result.find((r) => r.playerId === "p2")?.isWinner).toBe(false);
  });

  it("applies the value_debuff joker's -8% modifier to the debuffed pick's average", () => {
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: { intelligence: 60, physical_endurance: 60, mental_strength: 60 }, debuffed: true },
        { playerId: "p2", characterId: "c2", attributes: { intelligence: 56, physical_endurance: 56, mental_strength: 56 } },
      ],
      KEY_ATTRS,
    );
    // 60 * 0.92 = 55.2, now loses to p2's unmodified 56 average.
    expect(result.find((r) => r.playerId === "p1")?.average).toBeCloseTo(55.2, 5);
    expect(result.find((r) => r.playerId === "p2")?.isWinner).toBe(true);
    expect(result.find((r) => r.playerId === "p1")?.isWinner).toBe(false);
  });

  it("adds +10 to a pick's average when the player's nickname is Erenbaba (case-insensitive)", () => {
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: { intelligence: 80, physical_endurance: 80, mental_strength: 80 }, nickname: "erenbaba" },
        { playerId: "p2", characterId: "c2", attributes: { intelligence: 85, physical_endurance: 85, mental_strength: 85 } },
      ],
      KEY_ATTRS,
    );
    // 80 + 10 = 90, beats p2's unmodified 85 average.
    expect(result.find((r) => r.playerId === "p1")?.average).toBeCloseTo(90, 5);
    expect(result.find((r) => r.playerId === "p1")?.isWinner).toBe(true);
    expect(result.find((r) => r.playerId === "p2")?.isWinner).toBe(false);
  });

  it("caps the Erenbaba bonus at 98 instead of letting it exceed 98", () => {
    const result = computeRoundResult(
      [
        { playerId: "p1", characterId: "c1", attributes: { intelligence: 92, physical_endurance: 92, mental_strength: 92 }, nickname: "Erenbaba" },
      ],
      KEY_ATTRS,
    );
    // 92 + 10 = 102, capped down to 98.
    expect(result.find((r) => r.playerId === "p1")?.average).toBe(98);
  });

  it("leaves picks without boosted/debuffed flags unmodified", () => {
    const result = computeRoundResult(
      [{ playerId: "p1", characterId: "c1", attributes: { intelligence: 50, physical_endurance: 50, mental_strength: 50 } }],
      KEY_ATTRS,
    );
    expect(result[0].average).toBeCloseTo(50, 5);
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
