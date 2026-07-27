import OpenAI from "openai";
import { AI_TIMEOUT_MS, KEY_ATTRIBUTES_PER_ROUND } from "@/lib/constants";
import { BATTLE_ATTRIBUTES, BATTLE_ATTRIBUTE_KEYS, type BattleAttributeKey, isBattleAttributeKey } from "@/lib/attributes";
import {
  characterAttributesJsonSchema,
  type CharacterAttributesInput,
} from "@/lib/validation/adminSchemas";

let defaultClient: OpenAI | null = null;

function getDefaultClient(): OpenAI {
  if (defaultClient) return defaultClient;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable.");
  // maxRetries: 0 — the SDK's own default (2) retries would silently stack on
  // top of getKeyAttributes/getWinnerCommentary's own 2-attempt retry logic,
  // multiplying worst-case latency ~3x. This app manages retries itself.
  defaultClient = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com", maxRetries: 0 });
  return defaultClient;
}

const TOOL_NAME = "select_key_attributes";

const attributeSelectorTool = {
  type: "function" as const,
  function: {
    name: TOOL_NAME,
    description:
      `Select exactly the ${KEY_ATTRIBUTES_PER_ROUND} most critical attributes needed to overcome the given scenario.`,
    parameters: {
      type: "object",
      properties: {
        attributes: {
          type: "array",
          items: { type: "string", enum: [...BATTLE_ATTRIBUTE_KEYS] },
          minItems: KEY_ATTRIBUTES_PER_ROUND,
          maxItems: KEY_ATTRIBUTES_PER_ROUND,
        },
      },
      required: ["attributes"],
    },
  },
};

function systemPrompt(): string {
  return (
    "You are a game referee for a Turkish character-battle game. Given a scenario " +
    `(written in Turkish), select EXACTLY the ${KEY_ATTRIBUTES_PER_ROUND} most critical attributes needed to ` +
    "overcome it, from the fixed list of attribute keys below. You MUST return the " +
    "exact English snake_case keys from this list verbatim — never translate, " +
    "invent, or alter them, even though the scenario text itself is in Turkish.\n\n" +
    `Attribute keys: ${BATTLE_ATTRIBUTE_KEYS.join(", ")}`
  );
}

/** Minimal shape we depend on, so tests can pass a mock without the real SDK. */
export interface ChatCompletionsClient {
  chat: {
    completions: {
      create: (...args: Parameters<OpenAI["chat"]["completions"]["create"]>) => Promise<unknown>;
    };
  };
}

async function requestAttributes(
  client: ChatCompletionsClient,
  scenarioText: string,
  correction?: string,
): Promise<unknown> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: scenarioText },
  ];
  if (correction) messages.push({ role: "user", content: correction });

  const response = (await client.chat.completions.create(
    {
      model: "deepseek-chat",
      messages,
      tools: [attributeSelectorTool],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    } as Parameters<OpenAI["chat"]["completions"]["create"]>[0],
    { timeout: AI_TIMEOUT_MS } as Parameters<OpenAI["chat"]["completions"]["create"]>[1],
  )) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function: { arguments: string } }> } }>;
  };

  const call = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return null;
  }
}

function validateAttributes(parsed: unknown): BattleAttributeKey[] | null {
  if (!parsed || typeof parsed !== "object" || !("attributes" in parsed)) return null;
  const attrs = (parsed as { attributes: unknown }).attributes;
  if (!Array.isArray(attrs) || attrs.length !== KEY_ATTRIBUTES_PER_ROUND) return null;
  if (!attrs.every((a): a is string => typeof a === "string" && isBattleAttributeKey(a))) {
    return null;
  }
  if (new Set(attrs).size !== KEY_ATTRIBUTES_PER_ROUND) return null;
  return attrs as BattleAttributeKey[];
}

/**
 * Selects the KEY_ATTRIBUTES_PER_ROUND attributes most relevant to a
 * scenario, calling DeepSeek at most twice. Falls back to the scenario's own
 * `suggestedAttributes` if the model returns invalid output twice, or the
 * call fails/times out — a round must never be blocked by the AI.
 */
export async function getKeyAttributes(
  scenarioText: string,
  fallbackAttributes: readonly string[],
  client: ChatCompletionsClient = getDefaultClient(),
): Promise<BattleAttributeKey[]> {
  try {
    const first = validateAttributes(await requestAttributes(client, scenarioText));
    if (first) return first;

    const second = validateAttributes(
      await requestAttributes(
        client,
        scenarioText,
        `Your previous answer was invalid. Return EXACTLY ${KEY_ATTRIBUTES_PER_ROUND} unique attribute keys, copied verbatim from the provided list.`,
      ),
    );
    if (second) return second;
  } catch (error) {
    console.error("getKeyAttributes: DeepSeek call failed, falling back.", error);
  }

  const fallback = validateAttributes({ attributes: fallbackAttributes });
  if (!fallback) {
    throw new Error(`Fallback attributes are invalid: ${JSON.stringify(fallbackAttributes)}`);
  }
  return fallback;
}

/**
 * Same DeepSeek call/prompt/validation as getKeyAttributes (reuses
 * requestAttributes/validateAttributes directly), for the admin "AI ile
 * doldur" button when authoring a new scenario. Unlike getKeyAttributes,
 * there's no existing scenario to fall back to yet, so this returns null on
 * failure and the admin picks the 5 attributes manually instead.
 */
export async function getSuggestedScenarioAttributes(
  scenarioText: string,
  client: ChatCompletionsClient = getDefaultClient(),
): Promise<BattleAttributeKey[] | null> {
  try {
    const first = validateAttributes(await requestAttributes(client, scenarioText));
    if (first) return first;

    const second = validateAttributes(
      await requestAttributes(
        client,
        scenarioText,
        `Your previous answer was invalid. Return EXACTLY ${KEY_ATTRIBUTES_PER_ROUND} unique attribute keys, copied verbatim from the provided list.`,
      ),
    );
    if (second) return second;
  } catch (error) {
    console.error("getSuggestedScenarioAttributes: DeepSeek call failed.", error);
  }
  return null;
}

export interface CommentaryPickInput {
  characterName: string;
  playerNickname: string;
  average: number;
  isWinner: boolean;
  isAutoPick: boolean;
}

const COMMENTARY_TOOL_NAME = "write_winner_commentary";
const MAX_COMMENTARY_LENGTH = 320;

const commentaryTool = {
  type: "function" as const,
  function: {
    name: COMMENTARY_TOOL_NAME,
    description:
      "Write a short, lightly humorous Turkish explanation (1-2 sentences) of the round outcome.",
    parameters: {
      type: "object",
      properties: {
        commentary: { type: "string", maxLength: MAX_COMMENTARY_LENGTH },
      },
      required: ["commentary"],
    },
  },
};

function commentarySystemPrompt(): string {
  return (
    "You are a witty Turkish game-show commentator for a character-battle game. " +
    "Given a scenario and the characters who competed in it (with their scores), " +
    "write EXACTLY 1-2 sentences, in Turkish only, lightly humorous and fun, " +
    "explaining why the winner(s) came out on top. Reference the actual characters " +
    "and scenario — never invent facts about them. If multiple characters tied, " +
    "acknowledge the tie. Keep it light-hearted; avoid real-world political " +
    "opinions or commentary even if a character is a politician or historical " +
    `figure. Maximum ${MAX_COMMENTARY_LENGTH} characters.`
  );
}

function describePicks(scenarioText: string, keyAttributes: readonly string[], picks: readonly CommentaryPickInput[]): string {
  const lines = picks.map(
    (p) =>
      `- ${p.playerNickname} oynadı: ${p.characterName} (ortalama: ${p.average.toFixed(1)})` +
      `${p.isWinner ? " — KAZANDI" : ""}${p.isAutoPick ? " (otomatik seçildi)" : ""}`,
  );
  return (
    `Senaryo: ${scenarioText}\n` +
    `Kritik özellikler: ${keyAttributes.join(", ")}\n` +
    `Sonuçlar:\n${lines.join("\n")}`
  );
}

async function requestCommentary(
  client: ChatCompletionsClient,
  scenarioText: string,
  keyAttributes: readonly string[],
  picks: readonly CommentaryPickInput[],
  correction?: string,
): Promise<unknown> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: commentarySystemPrompt() },
    { role: "user", content: describePicks(scenarioText, keyAttributes, picks) },
  ];
  if (correction) messages.push({ role: "user", content: correction });

  const response = (await client.chat.completions.create(
    {
      model: "deepseek-chat",
      messages,
      tools: [commentaryTool],
      tool_choice: { type: "function", function: { name: COMMENTARY_TOOL_NAME } },
    } as Parameters<OpenAI["chat"]["completions"]["create"]>[0],
    { timeout: AI_TIMEOUT_MS } as Parameters<OpenAI["chat"]["completions"]["create"]>[1],
  )) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function: { arguments: string } }> } }>;
  };

  const call = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return null;
  }
}

function validateCommentary(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object" || !("commentary" in parsed)) return null;
  const commentary = (parsed as { commentary: unknown }).commentary;
  if (typeof commentary !== "string") return null;
  const trimmed = commentary.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_COMMENTARY_LENGTH) return null;
  return trimmed;
}

/** Deterministic Turkish fallback, used when the AI call fails or returns invalid output twice. */
export function fallbackCommentary(picks: readonly CommentaryPickInput[]): string {
  const winners = picks.filter((p) => p.isWinner);
  if (winners.length === picks.length) {
    return "Bu tur berabere bitti — kimse kimseye üstünlük sağlayamadı.";
  }
  if (winners.length > 1) {
    return `${winners.map((w) => w.characterName).join(" ve ")} bu turu paylaştı.`;
  }
  const winner = winners[0];
  return winner
    ? `${winner.characterName}, ${winner.average.toFixed(1)} averajla turu kazandı.`
    : "Round sonuçlandı.";
}

/**
 * Writes a short, fun Turkish explanation of why the round's winner(s) won.
 * Same isolated/fail-safe contract as getKeyAttributes: at most two DeepSeek
 * attempts, then a deterministic fallback — this must never block or delay
 * round scoring beyond the existing AI-timeout precedent.
 */
export async function getWinnerCommentary(
  scenarioText: string,
  keyAttributes: readonly string[],
  picks: readonly CommentaryPickInput[],
  client: ChatCompletionsClient = getDefaultClient(),
): Promise<string> {
  try {
    const first = validateCommentary(
      await requestCommentary(client, scenarioText, keyAttributes, picks),
    );
    if (first) return first;

    const second = validateCommentary(
      await requestCommentary(
        client,
        scenarioText,
        keyAttributes,
        picks,
        `Önceki cevabın geçersizdi. 1-2 cümle, sadece Türkçe, en fazla ${MAX_COMMENTARY_LENGTH} karakter olacak şekilde tekrar yaz.`,
      ),
    );
    if (second) return second;
  } catch (error) {
    console.error("getWinnerCommentary: DeepSeek call failed, falling back.", error);
  }

  return fallbackCommentary(picks);
}

const CHARACTER_ATTRIBUTES_TOOL_NAME = "suggest_character_attributes";

const characterAttributeProperties = Object.fromEntries(
  BATTLE_ATTRIBUTE_KEYS.map((key) => [key, { type: "integer", minimum: 0, maximum: 100 }]),
);

const characterAttributesTool = {
  type: "function" as const,
  function: {
    name: CHARACTER_ATTRIBUTES_TOOL_NAME,
    description:
      "Assign a 0-100 score to every battle attribute for the given character, based on real-world " +
      "or fictional knowledge of them.",
    parameters: {
      type: "object",
      properties: {
        ...characterAttributeProperties,
        height_cm: { type: "integer", minimum: 50, maximum: 250 },
        age: { type: "integer", minimum: 0, maximum: 130 },
      },
      required: [...BATTLE_ATTRIBUTE_KEYS],
      additionalProperties: false,
    },
  },
};

function characterAttributesSystemPrompt(): string {
  const attributeList = BATTLE_ATTRIBUTES.map((a) => `${a.key} (${a.label})`).join(", ");
  return (
    "You are assigning stats for a Turkish character-battle card game. Given a character's name " +
    "and category, assign a 0-100 score to EVERY one of the battle attributes listed below, based " +
    "on your real-world or fictional knowledge of that specific character (politician, historical " +
    "figure, athlete, actor, or a movie/TV/internet character). 50 represents an average person — " +
    "use the full 0-100 range where justified rather than clustering everything near 50. If the " +
    "character is fictional, base scores on their portrayal; if you have little knowledge of them, " +
    "still make your best reasonable estimate. Return the exact English snake_case keys below " +
    `verbatim, never translated or altered.\n\nAttributes: ${attributeList}\n\n` +
    "Also provide height_cm and age if they can be reasonably known or estimated; omit them only " +
    "if truly unknowable (e.g. an animal, or a character with no defined age)."
  );
}

async function requestCharacterAttributes(
  client: ChatCompletionsClient,
  name: string,
  categoryLabel: string,
  correction?: string,
): Promise<unknown> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: characterAttributesSystemPrompt() },
    { role: "user", content: `Karakter: ${name}\nKategori: ${categoryLabel}` },
  ];
  if (correction) messages.push({ role: "user", content: correction });

  const response = (await client.chat.completions.create(
    {
      model: "deepseek-chat",
      messages,
      tools: [characterAttributesTool],
      tool_choice: { type: "function", function: { name: CHARACTER_ATTRIBUTES_TOOL_NAME } },
    } as Parameters<OpenAI["chat"]["completions"]["create"]>[0],
    { timeout: AI_TIMEOUT_MS } as Parameters<OpenAI["chat"]["completions"]["create"]>[1],
  )) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function: { arguments: string } }> } }>;
  };

  const call = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return null;
  }
}

/**
 * Drafts a full set of battle attributes for a new character from just its
 * name and category, calling DeepSeek at most twice. Unlike getKeyAttributes/
 * getWinnerCommentary, there is no deterministic fallback here — a wrong
 * guess at "how charismatic is this person" has no sensible default — so
 * this returns null on failure and the caller must let the admin fill the
 * values in manually rather than silently guessing.
 */
export async function getSuggestedCharacterAttributes(
  name: string,
  categoryLabel: string,
  client: ChatCompletionsClient = getDefaultClient(),
): Promise<CharacterAttributesInput | null> {
  try {
    const first = characterAttributesJsonSchema.safeParse(
      await requestCharacterAttributes(client, name, categoryLabel),
    );
    if (first.success) return first.data;

    const second = characterAttributesJsonSchema.safeParse(
      await requestCharacterAttributes(
        client,
        name,
        categoryLabel,
        "Önceki cevabın geçersizdi. Tüm nitelikler için 0-100 arası bir tam sayı ver, istenen anahtarları verilen şekilde kullan.",
      ),
    );
    if (second.success) return second.data;
  } catch (error) {
    console.error("getSuggestedCharacterAttributes: DeepSeek call failed.", error);
  }
  return null;
}
