"use client";

import { useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api, ApiClientError } from "@/lib/client/api";
import { MIN_PLAYERS } from "@/lib/constants";

export function LobbyScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const online = useGameStore((s) => s.onlinePlayerIds);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleStart() {
    setError(null);
    setStarting(true);
    try {
      await api.startGame(gameId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Oyun başlatılamadı.");
      setStarting(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(state.game.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be unavailable (e.g. insecure context) — the code
      // is still visible on screen, so this is a silent no-op fallback.
    }
  }

  const canStart = state.me.isHost && state.players.length >= MIN_PLAYERS;

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-sm text-secondary-soft">Oda Kodu</p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-2 rounded-none border-2 border-secondary px-6 py-3 font-display text-xl tracking-widest shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform hover:border-accent active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          {state.game.roomCode}
        </button>
        <p className="mt-3 text-xs text-secondary-muted">{copied ? "Kopyalandı!" : "Kopyalamak için dokun"}</p>
      </div>

      <ul className="w-full max-w-sm space-y-2">
        {state.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-none border-2 border-line bg-surface px-4 py-3"
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 ${online.has(p.id) ? "bg-success" : "bg-secondary-muted"}`}
              />
              {p.nickname}
            </span>
            {p.isHost && <span className="text-xs text-accent">kurucu</span>}
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-danger">{error}</p>}

      {state.me.isHost ? (
        <button
          type="button"
          onClick={handleStart}
          disabled={starting || !canStart}
          className="w-full max-w-sm rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
        >
          {!canStart
            ? `En az ${MIN_PLAYERS} oyuncu gerekli`
            : starting
              ? "Başlatılıyor…"
              : "Oyunu Başlat"}
        </button>
      ) : (
        <p className="text-secondary-soft">Kurucunun oyunu başlatmasını bekleyin…</p>
      )}
    </main>
  );
}
