import { describe, expect, it } from "vitest";
import { generateRoomCode, insertWithUniqueRoomCode, isValidRoomCode } from "@/lib/room-code";
import { ROOM_CODE_LENGTH } from "@/lib/constants";

describe("generateRoomCode", () => {
  it("generates a code of the configured length using only unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });
});

describe("isValidRoomCode", () => {
  it("rejects the wrong length", () => {
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode("ABCDEFG")).toBe(false);
  });

  it("rejects ambiguous characters", () => {
    expect(isValidRoomCode("ABC0EF")).toBe(false);
    expect(isValidRoomCode("ABCOEF")).toBe(false);
    expect(isValidRoomCode("ABC1EF")).toBe(false);
  });

  it("accepts a valid 6-character code", () => {
    expect(isValidRoomCode("ABCDEF")).toBe(true);
  });
});

describe("insertWithUniqueRoomCode", () => {
  it("returns the result on the first successful insert", async () => {
    const result = await insertWithUniqueRoomCode(async (code) => ({ code }));
    expect(result.code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("retries on conflict (null) until success", async () => {
    let attempts = 0;
    const result = await insertWithUniqueRoomCode(async (code) => {
      attempts++;
      if (attempts < 3) return null;
      return { code };
    });
    expect(attempts).toBe(3);
    expect(result.code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("throws after exhausting max attempts", async () => {
    await expect(
      insertWithUniqueRoomCode(async () => null, 3),
    ).rejects.toThrow(/unique room code/i);
  });
});
