"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api } from "@/lib/client/api";
import { ROUND_DURATION_S } from "@/lib/constants";
import { useCharacters } from "@/lib/client/useCharacters";
import { useOptimisticPick } from "@/lib/client/useOptimisticPick";
import { CharacterCard } from "@/components/CharacterCard";
import { PickWaitingBanner } from "@/components/shared/PickWaitingBanner";
import { CountdownBar } from "@/components/shared/CountdownBar";
import { attributeLabel, isBattleAttributeKey } from "@/lib/attributes";
import { JokerWindowScreen } from "@/components/round/JokerWindowScreen";

export function RoundScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const round = state.round;
  const deckCharacters = useCharacters(state.me.deck);

  const deadlineAt = round?.status === "picking" ? round.deadlineAt : null;
  const myServerPick = round?.status === "picking" ? round.myPick : null;

  // Lazy initializer (not a synchronous setState-in-effect call) — correct
  // on first render because this component remounts per round (see the
  // `key` in GameClient), so a fresh deadline always means a fresh mount.
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    deadlineAt ? Math.max(0, new Date(deadlineAt).getTime() - Date.now()) : null,
  );

  useEffect(() => {
    if (!deadlineAt) return;
    const deadline = new Date(deadlineAt).getTime();
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  useEffect(() => {
    // Once our cosmetic countdown hits zero, ask the server to resolve — it
    // independently re-checks the real deadline (§3.2), so this can't be
    // used to shortcut the round even if a client's clock is off.
    if (remainingMs === 0) {
      api.resolveRound(gameId).catch(() => {});
    }
  }, [remainingMs, gameId]);

  const {
    effectiveValue: myPick,
    error,
    submitting,
    pick,
  } = useOptimisticPick(myServerPick, async (id) => {
    await api.submitPick(gameId, id);
  });

  if (round?.status === "joker_window") {
    return <JokerWindowScreen gameId={gameId} />;
  }

  if (!round || round.status !== "picking") {
    return (
      <main className="flex flex-1 items-center justify-center text-secondary-soft">
        Sonuçlar hesaplanıyor…
      </main>
    );
  }

  const usedSet = new Set(state.me.usedCharacters);

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-secondary-muted">Round {round.roundNumber}</p>
        <p className="mt-2 text-lg">{round.scenarioText}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {round.keyAttributes.map((attr) => (
            <span key={attr} className="rounded-none border-2 border-secondary bg-accent-soft px-3 py-1 text-sm text-secondary">
              {isBattleAttributeKey(attr) ? attributeLabel(attr) : attr}
            </span>
          ))}
        </div>
        <CountdownBar remainingMs={remainingMs} durationS={ROUND_DURATION_S} />
      </div>

      <PickWaitingBanner players={state.players} pickedPlayerIds={round.pickedPlayerIds} />

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      {myPick !== null ? (
        <p className="text-center text-secondary-soft">Seçimin gönderildi. Diğer oyuncular bekleniyor…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {deckCharacters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              dimmed={usedSet.has(c.id)}
              disabled={usedSet.has(c.id) || submitting}
              onClick={() => pick(c.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
