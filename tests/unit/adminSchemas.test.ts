import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BATTLE_ATTRIBUTE_KEYS } from "@/lib/attributes";
import {
  adminAccountCreateSchema,
  adminLoginSchema,
  characterAttributesJsonSchema,
  characterMetaSchema,
  scenarioSchema,
} from "@/lib/validation/adminSchemas";

function fullValidAttributes(): Record<string, number> {
  return Object.fromEntries(BATTLE_ATTRIBUTE_KEYS.map((key) => [key, 50]));
}

describe("characterAttributesJsonSchema", () => {
  it("accepts a full valid object", () => {
    expect(characterAttributesJsonSchema.safeParse(fullValidAttributes()).success).toBe(true);
  });

  it("accepts the committed template file", () => {
    const templatePath = path.join(process.cwd(), "data", "character-attributes-template.json");
    const data = JSON.parse(readFileSync(templatePath, "utf-8"));
    expect(characterAttributesJsonSchema.safeParse(data).success).toBe(true);
  });

  it("rejects a missing key", () => {
    const rest = Object.fromEntries(
      Object.entries(fullValidAttributes()).filter(([key]) => key !== "leadership"),
    );
    expect(characterAttributesJsonSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an out-of-range value", () => {
    expect(
      characterAttributesJsonSchema.safeParse({ ...fullValidAttributes(), leadership: 101 }).success,
    ).toBe(false);
  });

  it("rejects an unknown extra key (.strict())", () => {
    expect(
      characterAttributesJsonSchema.safeParse({ ...fullValidAttributes(), not_a_real_attribute: 1 })
        .success,
    ).toBe(false);
  });

  it("allows height_cm/age to be omitted", () => {
    expect(characterAttributesJsonSchema.safeParse(fullValidAttributes()).success).toBe(true);
  });
});

describe("characterMetaSchema", () => {
  it("accepts a known category", () => {
    expect(characterMetaSchema.safeParse({ name: "Test", category: "politician" }).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(characterMetaSchema.safeParse({ name: "Test", category: "not_a_category" }).success).toBe(
      false,
    );
  });
});

describe("scenarioSchema", () => {
  const validAttrs = ["leadership", "humor", "charisma", "courage", "intelligence"];

  it("accepts exactly 5 distinct valid attribute keys", () => {
    expect(
      scenarioSchema.safeParse({ text: "Bir senaryo.", suggestedAttributes: validAttrs }).success,
    ).toBe(true);
  });

  it("rejects fewer than 5 attributes", () => {
    expect(
      scenarioSchema.safeParse({ text: "Bir senaryo.", suggestedAttributes: validAttrs.slice(0, 4) })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown attribute key", () => {
    const withUnknown = [...validAttrs.slice(0, 4), "not_a_key"];
    expect(scenarioSchema.safeParse({ text: "Bir senaryo.", suggestedAttributes: withUnknown }).success).toBe(
      false,
    );
  });

  it("rejects duplicate attributes", () => {
    const withDup = [...validAttrs.slice(0, 4), validAttrs[0]];
    expect(scenarioSchema.safeParse({ text: "Bir senaryo.", suggestedAttributes: withDup }).success).toBe(
      false,
    );
  });
});

describe("adminLoginSchema / adminAccountCreateSchema", () => {
  it("accepts a basic login body", () => {
    expect(adminLoginSchema.safeParse({ username: "kadir", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password on login", () => {
    expect(adminLoginSchema.safeParse({ username: "kadir", password: "" }).success).toBe(false);
  });

  it("accepts a valid new-admin body", () => {
    expect(
      adminAccountCreateSchema.safeParse({ username: "kadir_2", password: "longenough", isSuperAdmin: false })
        .success,
    ).toBe(true);
  });

  it("rejects a too-short password", () => {
    expect(
      adminAccountCreateSchema.safeParse({ username: "kadir_2", password: "short", isSuperAdmin: false })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid username character", () => {
    expect(
      adminAccountCreateSchema.safeParse({ username: "kadir!", password: "longenough", isSuperAdmin: false })
        .success,
    ).toBe(false);
  });
});
