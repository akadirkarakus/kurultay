import { z } from "zod";

const nickname = z.string().trim().min(1, "Nickname is required").max(24);

export const createGameSchema = z.object({
  nickname,
});

export const joinGameSchema = z.object({
  roomCode: z.string().trim().length(6),
  nickname,
});

export const submitPickSchema = z.object({
  characterId: z.string().uuid(),
});

export const submitDraftPickSchema = z.object({
  characterId: z.string().uuid(),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type SubmitPickInput = z.infer<typeof submitPickSchema>;
export type SubmitDraftPickInput = z.infer<typeof submitDraftPickSchema>;
