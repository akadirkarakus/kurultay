import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/constants";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code.toUpperCase()].every((c) => ROOM_CODE_ALPHABET.includes(c));
}

/**
 * Generates a room code and calls `tryInsert` with it; `tryInsert` should
 * return `null` when the insert failed due to a room_code unique-constraint
 * conflict (so we regenerate and retry) and the created row otherwise.
 * Kept independent of any specific DB client so it's unit-testable with a
 * mock `tryInsert`.
 */
export async function insertWithUniqueRoomCode<T>(
  tryInsert: (code: string) => Promise<T | null>,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await tryInsert(generateRoomCode());
    if (result !== null) return result;
  }
  throw new Error(`Could not generate a unique room code after ${maxAttempts} attempts.`);
}
