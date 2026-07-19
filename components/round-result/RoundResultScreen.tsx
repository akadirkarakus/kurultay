"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api } from "@/lib/client/api";
import { CONTINUE_WINDOW_S } from "@/lib/constants";
import { attributeLabel, isBattleAttributeKey } from "@/lib/attributes";
import { PickWaitingBanner } from "@/components/shared/PickWaitingBanner";
import { CountdownBar } from "@/components/shared/CountdownBar";

export function RoundResultScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const round = state.round;
  const continueDeadlineAt = round && "continueDeadlineAt" in round ? round.continueDeadlineAt : null;

  // Lazy initializer, not a setState-in-effect call — correct on first render
  // because this component remounts per round (see the `key` in GameClient),
  // so a fresh deadline always means a fresh mount.
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    continueDeadlineAt ? Math.max(0, new Date(continueDeadlineAt).getTime() - Date.now()) : null,
  );
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    if (!continueDeadlineAt) return;
    const deadline = new Date(continueDeadlineAt).getTime();
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [continueDeadlineAt]);

  useEffect(() => {
    // Once our cosmetic countdown hits zero, ask the server to advance — it
    // independently re-checks the real deadline, so this can't be used to
    // shortcut the wait even if a client's clock is off. Acts purely as a
    // fallback: the normal path is every player clicking "Devam et".
    if (remainingMs === 0) {
      api.continueGame(gameId).catch(() => {});
    }
  }, [remainingMs, gameId]);

  function handleContinueClick() {
    setClicked(true);
    api.markContinueReady(gameId).catch(() => setClicked(false));
  }

  if (!round || !("picks" in round)) {
    return (
      <main className="flex flex-1 items-center justify-center text-secondary-soft">
        Sonuçlar hazırlanıyor…
      </main>
    );
  }

  // Merge in our own click optimistically so the waiting banner and button
  // update instantly, without waiting for the continue_ready_submitted
  // broadcast round-trip back to ourselves.
  const readyPlayerIds = clicked
    ? [...new Set([...round.continueReadyPlayerIds, state.me.id])]
    : round.continueReadyPlayerIds;
  const iAmReady = readyPlayerIds.includes(state.me.id);

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

      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleContinueClick}
          disabled={iAmReady}
          className="w-full rounded-none border-2 border-secondary bg-accent px-4 py-2 text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
        >
          {iAmReady ? "Bekleniyor…" : "Devam et"}
        </button>
        <PickWaitingBanner players={state.players} pickedPlayerIds={readyPlayerIds} />
        <CountdownBar remainingMs={remainingMs} durationS={CONTINUE_WINDOW_S} />
      </div>
    </main>
  );
}
