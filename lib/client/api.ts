import type { GameStateResponse } from "@/types/game";

class ApiClientError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(body?.error ?? `Request failed (${res.status})`, body?.code);
  }
  return body as T;
}

export const api = {
  createGame: (nickname: string) =>
    request<{ gameId: string; roomCode: string }>("/api/games", {
      method: "POST",
      body: JSON.stringify({ nickname }),
    }),
  createSinglePlayerGame: (nickname: string) =>
    request<{ gameId: string; roomCode: string }>("/api/games/single-player", {
      method: "POST",
      body: JSON.stringify({ nickname }),
    }),
  joinGame: (roomCode: string, nickname: string) =>
    request<{ gameId: string; roomCode: string }>("/api/games/join", {
      method: "POST",
      body: JSON.stringify({ roomCode, nickname }),
    }),
  resolveRoomCode: (roomCode: string) =>
    request<{ id: string; room_code: string; status: string }>(`/api/by-code/${roomCode}`),
  startGame: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/start`, { method: "POST" }),
  submitDraftPick: (gameId: string, characterId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/draft-pick`, {
      method: "POST",
      body: JSON.stringify({ characterId }),
    }),
  resolveDraftStep: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/draft-resolve`, { method: "POST" }),
  submitPick: (gameId: string, characterId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/pick`, {
      method: "POST",
      body: JSON.stringify({ characterId }),
    }),
  resolveRound: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/resolve`, { method: "POST" }),
  continueGame: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/continue`, { method: "POST" }),
  markContinueReady: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/continue-ready`, { method: "POST" }),
  useJoker: (
    gameId: string,
    body: { jokerKey: string; ownCharacterId?: string; targetPlayerId?: string },
  ) =>
    request<{ ok: true }>(`/api/games/${gameId}/joker-use`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  skipJoker: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/joker-skip`, { method: "POST" }),
  resolveJokerWindow: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/joker-resolve`, { method: "POST" }),
  markRematchReady: (gameId: string) =>
    request<{ ok: true }>(`/api/games/${gameId}/rematch-ready`, { method: "POST" }),
  getState: (gameId: string) => request<GameStateResponse>(`/api/games/${gameId}/state`),
};

export { ApiClientError };
