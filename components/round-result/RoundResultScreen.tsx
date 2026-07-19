"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api } from "@/lib/client/api";
import { RESULT_DISPLAY_S } from "@/lib/constants";
import { attributeLabel, isBattleAttributeKey } from "@/lib/attributes";

export function RoundResultScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const round = state.round;
  // This component remounts per round (see the `key` in GameClient), so a
  // plain initializer is enough to reset the countdown for each new result.
  const [remaining, setRemaining] = useState(RESULT_DISPLAY_S);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remaining === 0) {
      api.continueGame(gameId).catch(() => {});
    }
  }, [remaining, gameId]);

  if (!round || !("picks" in round)) {
    return (
      <main className="flex flex-1 items-center justify-center text-secondary-soft">
        Sonuçlar hazırlanıyor…
      </main>
    );
  }

  const maxAverage = Math.max(...round.picks.map((p) => p.average ?? 0));
  const playerById = new Map(state.players.map((p) => [p.id, p]));

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="text-center">
        <p className="text-sm text-secondary-muted">Round {round.roundNumber} Sonucu</p>
        <p className="mt-1 text-lg">{round.scenarioText}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {round.keyAttributes.map((attr) => (
            <span key={attr} className="rounded-none border-2 border-secondary bg-accent-soft px-3 py-1 text-sm text-secondary">
              {isBattleAttributeKey(attr) ? attributeLabel(attr) : attr}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {round.picks.map((pick) => {
          const player = playerById.get(pick.playerId);
          const isWinner = pick.average === maxAverage;
          return (
            <div
              key={pick.playerId}
              className={`rounded-none border-2 p-3 ${
                isWinner
                  ? "border-accent bg-accent-soft shadow-[4px_4px_0_0_var(--color-accent)]"
                  : "border-line bg-surface"
              }`}
            >
              <p className="text-sm text-secondary-soft">
                {player?.nickname ?? "?"}
                {pick.isAutoPick && " (otomatik)"}
              </p>
              <p>{pick.character?.name ?? "?"}</p>
              <p className="mt-1 font-mono text-2xl">{pick.average?.toFixed(1)}</p>
              {isWinner && (
                <p className="mt-1 font-display text-[0.6rem] tracking-wide text-accent">Round Kazananı</p>
              )}
            </div>
          );
        })}
      </div>

      {round.winnerCommentary && (
        <p className="mx-auto max-w-lg text-center text-base italic text-secondary-soft">
          “{round.winnerCommentary}”
        </p>
      )}

      <div className="mx-auto w-full max-w-sm rounded-none border-2 border-line bg-surface p-4">
        <p className="mb-2 text-center text-sm text-secondary-muted">Genel Skor</p>
        <ul className="space-y-1">
          {[...state.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.nickname}</span>
                <span className="font-mono">{p.score}</span>
              </li>
            ))}
        </ul>
      </div>

      <p className="text-center text-sm text-secondary-muted">{remaining}s sonra devam edilecek…</p>
    </main>
  );
}
