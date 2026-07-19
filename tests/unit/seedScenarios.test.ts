import { describe, expect, it } from "vitest";
import { SCENARIOS, validateScenarios } from "@/scripts/seed-scenarios";

describe("seed scenarios", () => {
  it("has at least 20 scenarios", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
  });

  it("passes validation (exactly 3 valid attribute keys each)", () => {
    expect(() => validateScenarios()).not.toThrow();
  });

  it("covers a mix of attribute themes, not the same 3 repeated", () => {
    const uniqueCombos = new Set(SCENARIOS.map((s) => s.suggestedAttributes.join(",")));
    expect(uniqueCombos.size).toBeGreaterThan(10);
  });
});
