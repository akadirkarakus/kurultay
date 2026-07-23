"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { api, ApiClientError } from "@/lib/client/api";
import { PickWaitingBanner } from "@/components/shared/PickWaitingBanner";

export function GameOverScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = sorted.filter((p) => p.score === topScore);

  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRematchClick() {
    setError(null);
    setClicked(true);
    try {
      await api.markRematchReady(gameId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Yeniden başlatılamadı.");
      setClicked(false);
    }
  }

  // Merge in our own click optimistically, same reasoning as RoundResultScreen's
  // readyPlayerIds — updates the waiting banner instantly instead of waiting for
  // the next games-row realtime refetch to come back around to us.
  const readyPlayerIds = clicked
    ? [...new Set([...state.game.rematchReadyPlayerIds, state.me.id])]
    : state.game.rematchReadyPlayerIds;
  const iAmReady = readyPlayerIds.includes(state.me.id);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div>
        <p className="text-sm text-secondary-muted">Oyun Bitti</p>
        <h1 className="mt-3 font-display text-lg leading-relaxed tracking-wide">
          {winners.length > 1
            ? `${winners.map((w) => w.nickname).join(", ")} berabere kazandı!`
            : `${winners[0]?.nickname} kazandı!`}
        </h1>
      </div>

      <ul className="w-full max-w-sm space-y-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-none border-2 px-4 py-3 ${
              p.score === topScore
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface"
            }`}
          >
            <span>
              {i + 1}. {p.nickname}
              {p.isBot && " 🤖"}
            </span>
            <span className="font-mono">{p.score}</span>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleRematchClick}
          disabled={iAmReady}
          className="w-full rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-60"
        >
          {iAmReady ? "Bekleniyor…" : "Yeniden Oyna"}
        </button>
        <PickWaitingBanner players={state.players} pickedPlayerIds={readyPlayerIds} />
        <Link href="/" className="text-sm text-secondary-soft underline underline-offset-2 hover:text-secondary">
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
