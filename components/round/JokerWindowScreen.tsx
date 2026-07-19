"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api } from "@/lib/client/api";
import { JOKER_WINDOW_DURATION_S } from "@/lib/constants";
import { CharacterCard } from "@/components/CharacterCard";
import { PickWaitingBanner } from "@/components/shared/PickWaitingBanner";
import { CountdownBar } from "@/components/shared/CountdownBar";
import { attributeLabel, isBattleAttributeKey } from "@/lib/attributes";
import type { JokerCatalogEntry, RoundViewJokerWindow } from "@/types/game";

export function JokerWindowScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const round = state.round;
  const jokerDeadlineAt = round && round.status === "joker_window" ? round.jokerDeadlineAt : null;

  // Lazy initializer, not a setState-in-effect call — correct on first
  // render because this component only mounts while round.status is
  // "joker_window", and a fresh round always means a fresh mount (see the
  // `key` on RoundScreen's parent in GameClient).
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    jokerDeadlineAt ? Math.max(0, new Date(jokerDeadlineAt).getTime() - Date.now()) : null,
  );
  const [selectedJoker, setSelectedJoker] = useState<JokerCatalogEntry | null>(null);
  const [ownCharacterId, setOwnCharacterId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jokerDeadlineAt) return;
    const deadline = new Date(jokerDeadlineAt).getTime();
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [jokerDeadlineAt]);

  useEffect(() => {
    // Once our cosmetic countdown hits zero, ask the server to close the
    // window — it independently re-checks the real deadline, so this can't
    // be used to shortcut the wait even if a client's clock is off.
    if (remainingMs === 0) {
      api.resolveJokerWindow(gameId).catch(() => {});
    }
  }, [remainingMs, gameId]);

  if (!round || round.status !== "joker_window") return null;
  // Give the narrowed type an explicit name: TS doesn't carry the control-flow
  // narrowing above into the nested function declarations below (they're only
  // ever invoked from elements rendered further down, after this same guard).
  const jokerRound: RoundViewJokerWindow = round;

  // Submits directly from whichever click handler completes the required
  // selections for the chosen joker — always a synchronous user event, never
  // a reactive effect, so a single opponent or an own-character-only joker
  // can skip straight to submission without ever rendering a redundant step.
  async function submit(jokerKey: string, ownId: string | null, targetId: string | null) {
    setSubmitted(true);
    setError(null);
    try {
      await api.useJoker(gameId, {
        jokerKey,
        ownCharacterId: ownId ?? undefined,
        targetPlayerId: targetId ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Joker kullanılamadı.");
      setSubmitted(false);
      setSelectedJoker(null);
      setOwnCharacterId(null);
    }
  }

  async function skip() {
    setError(null);
    try {
      await api.skipJoker(gameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    }
  }

  function chooseJoker(joker: JokerCatalogEntry) {
    setSelectedJoker(joker);
    if (!joker.needsOwnCharacter && joker.needsTargetPlayer && jokerRound.opponents.length === 1) {
      submit(joker.key, null, jokerRound.opponents[0].id);
    } else if (!joker.needsOwnCharacter && !joker.needsTargetPlayer) {
      submit(joker.key, null, null);
    }
  }

  function chooseOwnCharacter(characterId: string) {
    setOwnCharacterId(characterId);
    if (!selectedJoker) return;
    if (!selectedJoker.needsTargetPlayer) {
      submit(selectedJoker.key, characterId, null);
    } else if (jokerRound.opponents.length === 1) {
      submit(selectedJoker.key, characterId, jokerRound.opponents[0].id);
    }
  }

  function chooseTarget(targetPlayerId: string) {
    if (!selectedJoker) return;
    submit(selectedJoker.key, ownCharacterId, targetPlayerId);
  }

  const waitingOnly = !round.myJokerAvailable || round.myDecidedThisRound || submitted;

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-secondary-muted">Round {round.roundNumber} — Joker Penceresi</p>
        <p className="mt-2 text-lg">{round.scenarioText}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {round.keyAttributes.map((attr) => (
            <span
              key={attr}
              className="rounded-none border-2 border-secondary bg-accent-soft px-3 py-1 text-sm text-secondary"
            >
              {isBattleAttributeKey(attr) ? attributeLabel(attr) : attr}
            </span>
          ))}
        </div>
        <CountdownBar remainingMs={remainingMs} durationS={JOKER_WINDOW_DURATION_S} />
      </div>

      <PickWaitingBanner players={state.players} pickedPlayerIds={round.decidedPlayerIds} />

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      {waitingOnly ? (
        <p className="text-center text-secondary-soft">
          {round.myJokerAvailable
            ? "Kararın gönderildi. Diğer oyuncular bekleniyor…"
            : "Jokerin yok. Diğer oyuncular bekleniyor…"}
        </p>
      ) : !selectedJoker ? (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          {round.availableJokers.map((joker) => (
            <button
              key={joker.key}
              type="button"
              onClick={() => chooseJoker(joker)}
              className="rounded-none border-2 border-secondary bg-surface p-3 text-left transition hover:border-accent"
            >
              <p className="font-display text-xs tracking-wide">{joker.name}</p>
              <p className="mt-1 text-sm text-secondary-soft">{joker.description}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={skip}
            className="rounded-none border-2 border-line bg-dominant-soft px-4 py-2 text-secondary-soft"
          >
            Jokersiz devam et
          </button>
        </div>
      ) : selectedJoker.needsOwnCharacter && ownCharacterId === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {round.myDeck.map((c) => (
            <CharacterCard key={c.id} character={c} onClick={() => chooseOwnCharacter(c.id)} />
          ))}
        </div>
      ) : selectedJoker.needsTargetPlayer ? (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
          {round.opponents.map((opp) => (
            <button
              key={opp.id}
              type="button"
              onClick={() => chooseTarget(opp.id)}
              className="rounded-none border-2 border-secondary bg-surface px-4 py-2"
            >
              {opp.nickname}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-secondary-soft">Gönderiliyor…</p>
      )}
    </main>
  );
}
