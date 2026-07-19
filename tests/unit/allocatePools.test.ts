import { describe, expect, it } from "vitest";
import { allocateDisjointPools, InsufficientCharacterPoolError } from "@/lib/game-logic/allocatePools";

function ids(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

describe("allocateDisjointPools", () => {
  it("gives every player a pool of the requested size", () => {
    const pools = allocateDisjointPools(ids("c", 40), ["p1", "p2", "p3", "p4"], 10);
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      expect(pools[playerId]).toHaveLength(10);
    }
  });

  it("never assigns the same character to two players (the core guarantee)", () => {
    const characters = ids("c", 100);
    const players = ["p1", "p2", "p3", "p4"];
    const pools = allocateDisjointPools(characters, players, 10);

    const seen = new Set<string>();
    for (const playerId of players) {
      for (const charId of pools[playerId]) {
        expect(seen.has(charId)).toBe(false);
        seen.add(charId);
      }
    }
  });

  it("works with 2 and 3 players too", () => {
    for (const count of [2, 3, 4]) {
      const players = ids("p", count);
      const pools = allocateDisjointPools(ids("c", 60), players, 10);
      const allAssigned = players.flatMap((p) => pools[p]);
      expect(new Set(allAssigned).size).toBe(allAssigned.length);
    }
  });

  it("throws InsufficientCharacterPoolError when the roster is too small", () => {
    expect(() => allocateDisjointPools(ids("c", 10), ["p1", "p2", "p3", "p4"], 10)).toThrow(
      InsufficientCharacterPoolError,
    );
  });

  it("is deterministic given an injected rng", () => {
    const rng = () => 0; // no-op shuffle: Fisher-Yates with rng()=0 always swaps with index 0
    const pools = allocateDisjointPools(ids("c", 20), ["p1", "p2"], 10, rng);
    expect(pools.p1).toHaveLength(10);
    expect(pools.p2).toHaveLength(10);
  });
});
