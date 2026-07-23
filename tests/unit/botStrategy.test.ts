import { describe, expect, it } from "vitest";
import { pickBestDraftCharacter, pickBestRoundCharacter } from "@/lib/game-logic/botStrategy";
import { BATTLE_ATTRIBUTE_KEYS } from "@/lib/attributes";

function fullAttributes(value: number): Record<string, number> {
  return Object.fromEntries(BATTLE_ATTRIBUTE_KEYS.map((key) => [key, value]));
}

describe("pickBestDraftCharacter", () => {
  it("picks the character with the highest overall average", () => {
    const offer = [
      { id: "a", attributes: fullAttributes(50) },
      { id: "b", attributes: fullAttributes(90) },
      { id: "c", attributes: fullAttributes(30) },
    ];
    expect(pickBestDraftCharacter(offer)).toBe("b");
  });

  it("is deterministic for a single candidate", () => {
    const offer = [{ id: "only", attributes: fullAttributes(10) }];
    expect(pickBestDraftCharacter(offer, () => 0.99)).toBe("only");
  });

  it("breaks ties using the injected rng", () => {
    const offer = [
      { id: "a", attributes: fullAttributes(80) },
      { id: "b", attributes: fullAttributes(80) },
      { id: "c", attributes: fullAttributes(10) },
    ];
    expect(pickBestDraftCharacter(offer, () => 0)).toBe("a");
    expect(pickBestDraftCharacter(offer, () => 0.99)).toBe("b");
  });

  it("throws if a character is missing one of the battle attributes", () => {
    const offer = [{ id: "a", attributes: { leadership: 50 } }];
    expect(() => pickBestDraftCharacter(offer)).toThrow(/missing attribute/);
  });
});

describe("pickBestRoundCharacter", () => {
  const KEY_ATTRS = ["intelligence", "physical_endurance", "mental_strength"];

  it("picks the character with the highest average across only the key attributes", () => {
    const deck = [
      // Strong overall, but weak on this round's key attributes.
      { id: "generalist", attributes: { intelligence: 20, physical_endurance: 20, mental_strength: 20, humor: 99 } },
      // Weaker overall, but the best fit for this round's key attributes.
      { id: "specialist", attributes: { intelligence: 90, physical_endurance: 85, mental_strength: 88, humor: 5 } },
    ];
    expect(pickBestRoundCharacter(deck, KEY_ATTRS)).toBe("specialist");
  });

  it("is deterministic for a single candidate", () => {
    const deck = [{ id: "only", attributes: { intelligence: 10, physical_endurance: 10, mental_strength: 10 } }];
    expect(pickBestRoundCharacter(deck, KEY_ATTRS, () => 0.5)).toBe("only");
  });

  it("breaks ties using the injected rng", () => {
    const attrs = { intelligence: 60, physical_endurance: 60, mental_strength: 60 };
    const deck = [
      { id: "a", attributes: attrs },
      { id: "b", attributes: attrs },
    ];
    expect(pickBestRoundCharacter(deck, KEY_ATTRS, () => 0)).toBe("a");
    expect(pickBestRoundCharacter(deck, KEY_ATTRS, () => 0.99)).toBe("b");
  });

  it("throws if a character is missing one of the key attributes", () => {
    const deck = [{ id: "a", attributes: { intelligence: 50 } }];
    expect(() => pickBestRoundCharacter(deck, KEY_ATTRS)).toThrow(/missing attribute/);
  });
});
