import { z } from "zod";
import { BATTLE_ATTRIBUTE_KEYS, isBattleAttributeKey } from "@/lib/attributes";
import { CHARACTER_CATEGORIES } from "@/lib/categories";
import { KEY_ATTRIBUTES_PER_ROUND } from "@/lib/constants";

// Built from BATTLE_ATTRIBUTE_KEYS rather than re-listing the 27 keys here,
// so lib/attributes.ts stays the single source of truth.
const attributeScoreShape = Object.fromEntries(
  BATTLE_ATTRIBUTE_KEYS.map((key) => [key, z.number().min(0).max(100)]),
) as Record<(typeof BATTLE_ATTRIBUTE_KEYS)[number], z.ZodNumber>;

// .strict() so an uploaded JSON with a misspelled/unknown key is rejected
// with a clear error instead of being silently dropped.
export const characterAttributesJsonSchema = z
  .object({
    ...attributeScoreShape,
    height_cm: z.number().positive().optional(),
    age: z.number().int().positive().optional(),
  })
  .strict();

export type CharacterAttributesInput = z.infer<typeof characterAttributesJsonSchema>;

export const characterMetaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(CHARACTER_CATEGORIES),
});

export type CharacterMetaInput = z.infer<typeof characterMetaSchema>;

// Serves three admin actions with one schema: a single-cell attribute edit
// (`{ attributes: { leadership: 82 } }`), a bulk JSON re-upload (`{
// attributes: <full object> }`), and name/category edits.
export const characterUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.enum(CHARACTER_CATEGORIES).optional(),
    attributes: characterAttributesJsonSchema.partial().optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.category !== undefined || data.attributes !== undefined,
    { message: "En az bir alan güncellenmelidir." },
  );

export type CharacterUpdateInput = z.infer<typeof characterUpdateSchema>;

// Deliberately stricter than scripts/seed-scenarios.ts's validateScenarios():
// this also rejects duplicate attributes among the 5 picks, which the
// existing script-side check does not.
export const scenarioAttributesSchema = z
  .array(z.string())
  .length(KEY_ATTRIBUTES_PER_ROUND)
  .refine((arr) => arr.every((key) => isBattleAttributeKey(key)), {
    message: "Geçersiz nitelik anahtarı.",
  })
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "Nitelikler birbirinden farklı olmalı.",
  });

export const scenarioSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  suggestedAttributes: scenarioAttributesSchema,
});

export type ScenarioInput = z.infer<typeof scenarioSchema>;

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminAccountCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Kullanıcı adı sadece harf, rakam, _ . - içerebilir."),
  password: z.string().min(8),
  isSuperAdmin: z.boolean().default(false),
});

export type AdminAccountCreateInput = z.infer<typeof adminAccountCreateSchema>;
