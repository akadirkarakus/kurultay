import { create } from "zustand";
import type { GameStateResponse } from "@/types/game";

interface GameStore {
  state: GameStateResponse | null;
  onlinePlayerIds: Set<string>;
  error: string | null;
  setState: (s: GameStateResponse) => void;
  setOnlinePlayerIds: (ids: Set<string>) => void;
  setError: (message: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  state: null,
  onlinePlayerIds: new Set(),
  error: null,
  setState: (state) => set({ state }),
  setOnlinePlayerIds: (onlinePlayerIds) => set({ onlinePlayerIds }),
  setError: (error) => set({ error }),
}));
