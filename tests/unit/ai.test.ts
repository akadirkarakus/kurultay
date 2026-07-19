import { describe, expect, it, vi } from "vitest";
import {
  getKeyAttributes,
  getWinnerCommentary,
  fallbackCommentary,
  type ChatCompletionsClient,
  type CommentaryPickInput,
} from "@/lib/ai";

const FALLBACK = ["intelligence", "physical_endurance", "mental_strength", "courage", "leadership"];

function mockClient(...responses: unknown[]): ChatCompletionsClient {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  return { chat: { completions: { create } } };
}

function toolCallResponse(args: unknown) {
  return {
    choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }],
  };
}

describe("getKeyAttributes", () => {
  it("returns the model's attributes on a valid first response", async () => {
    const client = mockClient(
      toolCallResponse({
        attributes: ["leadership", "courage", "physical_strength", "composure", "diligence"],
      }),
    );
    const result = await getKeyAttributes("Bir savaş senaryosu", FALLBACK, client);
    expect(result).toEqual(["leadership", "courage", "physical_strength", "composure", "diligence"]);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it("retries once on invalid keys, then accepts the corrected response", async () => {
    const client = mockClient(
      toolCallResponse({
        attributes: ["not_a_real_key", "leadership", "courage", "composure", "diligence"],
      }),
      toolCallResponse({
        attributes: ["leadership", "courage", "humor", "composure", "diligence"],
      }),
    );
    const result = await getKeyAttributes("Bir senaryo", FALLBACK, client);
    expect(result).toEqual(["leadership", "courage", "humor", "composure", "diligence"]);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("falls back to the scenario's suggested attributes after two invalid responses", async () => {
    const client = mockClient(
      toolCallResponse({ attributes: ["nope", "leadership", "courage", "composure", "diligence"] }),
      toolCallResponse({ attributes: ["still_nope"] }),
    );
    const result = await getKeyAttributes("Bir senaryo", FALLBACK, client);
    expect(result).toEqual(FALLBACK);
  });

  it("falls back when the response has duplicate attributes", async () => {
    const client = mockClient(
      toolCallResponse({
        attributes: ["leadership", "leadership", "courage", "composure", "diligence"],
      }),
      toolCallResponse({
        attributes: ["leadership", "leadership", "courage", "composure", "diligence"],
      }),
    );
    const result = await getKeyAttributes("Bir senaryo", FALLBACK, client);
    expect(result).toEqual(FALLBACK);
  });

  it("falls back when the call throws (timeout/network error)", async () => {
    const create = vi.fn().mockRejectedValue(new Error("timeout"));
    const client: ChatCompletionsClient = { chat: { completions: { create } } };
    const result = await getKeyAttributes("Bir senaryo", FALLBACK, client);
    expect(result).toEqual(FALLBACK);
  });

  it("falls back when no tool call is present in the response", async () => {
    const client = mockClient({ choices: [{ message: {} }] }, { choices: [{ message: {} }] });
    const result = await getKeyAttributes("Bir senaryo", FALLBACK, client);
    expect(result).toEqual(FALLBACK);
  });
});

const SOLE_WINNER: CommentaryPickInput[] = [
  { characterName: "Messi", playerNickname: "Ali", average: 90, isWinner: true, isAutoPick: false },
  { characterName: "Ronaldo", playerNickname: "Veli", average: 70, isWinner: false, isAutoPick: false },
];

const TWO_WAY_TIE: CommentaryPickInput[] = [
  { characterName: "Messi", playerNickname: "Ali", average: 80, isWinner: true, isAutoPick: false },
  { characterName: "Ronaldo", playerNickname: "Veli", average: 80, isWinner: true, isAutoPick: false },
  { characterName: "Pele", playerNickname: "Ayşe", average: 60, isWinner: false, isAutoPick: true },
];

const ALL_TIE: CommentaryPickInput[] = [
  { characterName: "Messi", playerNickname: "Ali", average: 50, isWinner: true, isAutoPick: false },
  { characterName: "Ronaldo", playerNickname: "Veli", average: 50, isWinner: true, isAutoPick: false },
];

describe("getWinnerCommentary", () => {
  it("returns the model's commentary on a valid first response", async () => {
    const client = mockClient(toolCallResponse({ commentary: "Messi'nin ayakları büyülü!" }));
    const result = await getWinnerCommentary("Futbol turnuvası", ["creativity"], SOLE_WINNER, client);
    expect(result).toBe("Messi'nin ayakları büyülü!");
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it("retries once on an invalid response, then accepts the correction", async () => {
    const client = mockClient(
      toolCallResponse({ commentary: "" }),
      toolCallResponse({ commentary: "İkinci deneme kazandı." }),
    );
    const result = await getWinnerCommentary("Senaryo", ["creativity"], SOLE_WINNER, client);
    expect(result).toBe("İkinci deneme kazandı.");
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("falls back after two invalid responses", async () => {
    const client = mockClient(
      toolCallResponse({ commentary: "x".repeat(500) }), // too long
      toolCallResponse({ commentary: "   " }), // empty after trim
    );
    const result = await getWinnerCommentary("Senaryo", ["creativity"], SOLE_WINNER, client);
    expect(result).toBe(fallbackCommentary(SOLE_WINNER));
  });

  it("falls back when the call throws (timeout/network error)", async () => {
    const create = vi.fn().mockRejectedValue(new Error("timeout"));
    const client: ChatCompletionsClient = { chat: { completions: { create } } };
    const result = await getWinnerCommentary("Senaryo", ["creativity"], SOLE_WINNER, client);
    expect(result).toBe(fallbackCommentary(SOLE_WINNER));
  });

  it("falls back when no tool call is present in the response", async () => {
    const client = mockClient({ choices: [{ message: {} }] }, { choices: [{ message: {} }] });
    const result = await getWinnerCommentary("Senaryo", ["creativity"], SOLE_WINNER, client);
    expect(result).toBe(fallbackCommentary(SOLE_WINNER));
  });
});

describe("fallbackCommentary", () => {
  it("names the sole winner with their average", () => {
    expect(fallbackCommentary(SOLE_WINNER)).toBe("Messi, 90.0 averajla turu kazandı.");
  });

  it("names all tied winners when some but not all players tie", () => {
    expect(fallbackCommentary(TWO_WAY_TIE)).toBe("Messi ve Ronaldo bu turu paylaştı.");
  });

  it("uses the all-tied phrasing when every player ties", () => {
    expect(fallbackCommentary(ALL_TIE)).toBe(
      "Bu tur berabere bitti — kimse kimseye üstünlük sağlayamadı.",
    );
  });
});
