"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api } from "@/lib/client/api";
import { CONTINUE_WINDOW_S, ROUND_COUNT } from "@/lib/constants";
import { attributeLabel, isBattleAttributeKey } from "@/lib/attributes";
import { PickWaitingBanner } from "@/components/shared/PickWaitingBanner";
import { CountdownBar } from "@/components/shared/CountdownBar";
import type { PlayerSummary, RoundPickReveal } from "@/types/game";

/** Timing for the result reveal: cards slide in, then every score counts up
 * from zero at once, then the AI commentary types out. Named constants since
 * multiple effects/components below coordinate off them. */
const CARD_ENTRANCE_MS = 380;
const SCORE_COUNT_MS = 1000;
const COMMENTARY_START_DELAY_MS = 250;
const COMMENTARY_MS_PER_CHAR = 16;

/** Timing for the final-round cinematic (§ "son raund"): a title beat, a
 * typed scenario recap, then a suspenseful one-card-at-a-time reveal
 * (weakest to strongest, so the winner lands last) before falling through to
 * the normal full result screen below. */
const FINAL_ROUND_TITLE_DELAY_MS = 900;
const FINAL_ROUND_MS_PER_CHAR = 28;
const FINAL_ROUND_INTRO_PAUSE_MS = 800;
const FINAL_ROUND_CARD_MS = 1700;
const FINAL_ROUND_REVEAL_PAUSE_MS = 800;

function AnimatedScoreValue({
  target,
  active,
  durationMs,
  onComplete,
}: {
  target: number;
  active: boolean;
  durationMs: number;
  onComplete: () => void;
}) {
  const [value, setValue] = useState(0);
  // Ref instead of a direct effect dependency: onComplete is a fresh closure
  // every render, and depending on it directly would restart the in-flight
  // RAF loop (resetting the count to 0) whenever an unrelated realtime
  // update re-renders the parent mid-animation.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - (1 - t) * (1 - t)));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onCompleteRef.current();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);

  return <>{value.toFixed(1)}</>;
}

function TypewriterText({
  text,
  msPerChar,
  onComplete,
}: {
  text: string;
  msPerChar: number;
  onComplete?: () => void;
}) {
  const [count, setCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, msPerChar);
    return () => clearInterval(interval);
  }, [text, msPerChar]);

  return <>{text.slice(0, count)}</>;
}

/** A single oversized pick card for the final-round reveal sequence — a
 * display-only cousin of CharacterCard (no click handling, no dimming).
 * Mount its own entrance animation rather than taking a `mounted` prop from
 * the parent, so remounting it via `key` per reveal step is enough to replay
 * the animation for each new card. */
function RevealCard({
  pick,
  player,
  isWinner,
}: {
  pick: RoundPickReveal;
  player: PlayerSummary | undefined;
  isWinner: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);
  const name = pick.character?.name ?? "?";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`mx-auto flex w-fit flex-col overflow-hidden rounded-none border-2 bg-surface transition-all duration-500 ease-out ${
        mounted ? "scale-100 opacity-100" : "scale-90 opacity-0"
      } ${
        isWinner
          ? "border-accent shadow-[6px_6px_0_0_var(--color-accent)]"
          : "border-secondary shadow-[4px_4px_0_0_var(--color-secondary)]"
      }`}
    >
      {/* Height-driven, not width-driven: clamped to the viewport so the
          card can never grow larger than the screen, and shrinks itself
          (and the whole card, via aspect-ratio) on short viewports. */}
      <div className="aspect-3/4 h-[clamp(8rem,28vh,15rem)] bg-dominant-soft">
        {pick.character?.image_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pick.character.image_url}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-xl text-secondary-muted">
            {initials}
          </div>
        )}
      </div>
      <div className="p-3 text-center">
        <p className="text-xs text-secondary-soft sm:text-sm">
          {player?.nickname ?? "?"}
          {player?.isBot && " 🤖"}
        </p>
        <p className="mt-1 text-base sm:text-lg">{name}</p>
        <p className="mt-1 font-mono text-2xl sm:text-3xl">
          <AnimatedScoreValue target={pick.average ?? 0} active={mounted} durationMs={SCORE_COUNT_MS} onComplete={() => {}} />
        </p>
        {isWinner && (
          <p className="mt-1 font-display text-[0.6rem] tracking-wide text-accent sm:text-xs">Round Kazananı</p>
        )}
      </div>
    </div>
  );
}

export function RoundResultScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const round = state.round;
  const continueDeadlineAt = round && "continueDeadlineAt" in round ? round.continueDeadlineAt : null;
  // Deliberately compared against the fixed ROUND_COUNT, not the (possibly
  // tie-break-bumped) state.game.maxRounds: a tie-break round also satisfies
  // roundNumber === maxRounds, which would replay the whole "SON RAUND"
  // cinematic a second time for it. The cinematic is a once-per-game beat
  // for the last ordinary round; a tie-break round's result just uses the
  // plain result screen below, like rounds 1-3.
  const isFinalRound = round ? round.roundNumber === ROUND_COUNT : false;

  // Lazy initializer, not a setState-in-effect call — correct on first render
  // because this component remounts per round (see the `key` in GameClient),
  // so a fresh deadline always means a fresh mount.
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    continueDeadlineAt ? Math.max(0, new Date(continueDeadlineAt).getTime() - Date.now()) : null,
  );
  const [clicked, setClicked] = useState(false);

  const picks = round && "picks" in round ? round.picks : [];

  // Final-round cinematic: SON RAUND title -> typed scenario -> weakest-to-
  // strongest card reveal -> falls through to "result" (the normal screen
  // below). Non-final rounds start straight at "result", unchanged.
  const [phase, setPhase] = useState<"intro" | "reveal" | "result">(() => (isFinalRound ? "intro" : "result"));
  const [titleMounted, setTitleMounted] = useState(false);
  const [startTyping, setStartTyping] = useState(false);
  const [scenarioTyped, setScenarioTyped] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);

  const [cardsMounted, setCardsMounted] = useState(false);
  const [countingStarted, setCountingStarted] = useState(false);
  const [completedPlayerIds, setCompletedPlayerIds] = useState<Set<string>>(() => new Set());
  const [commentaryActive, setCommentaryActive] = useState(false);

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

  // Intro: fade the title in, then start typing the scenario recap.
  useEffect(() => {
    if (phase !== "intro") return;
    const t1 = setTimeout(() => setTitleMounted(true), 20);
    const t2 = setTimeout(() => setStartTyping(true), FINAL_ROUND_TITLE_DELAY_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  // Once the scenario has fully typed out, pause briefly then start the
  // reveal (or skip straight to the result screen if there's nothing to
  // reveal — shouldn't happen once a round has resolved, but keeps this
  // effect from ever entering "reveal" with an empty pick list).
  useEffect(() => {
    if (phase !== "intro" || !scenarioTyped) return;
    const t = setTimeout(
      () => setPhase(picks.length === 0 ? "result" : "reveal"),
      FINAL_ROUND_INTRO_PAUSE_MS,
    );
    return () => clearTimeout(t);
  }, [phase, scenarioTyped, picks.length]);

  // Reveal: show one card at a time, weakest to strongest, then move on to
  // the full result screen once the winner's card has had its moment (with
  // an extra beat of dwell time on that last, winning card).
  useEffect(() => {
    if (phase !== "reveal") return;
    const isLast = revealIndex >= picks.length - 1;
    const t = setTimeout(
      () => {
        if (isLast) setPhase("result");
        else setRevealIndex((i) => i + 1);
      },
      isLast ? FINAL_ROUND_CARD_MS + FINAL_ROUND_REVEAL_PAUSE_MS : FINAL_ROUND_CARD_MS,
    );
    return () => clearTimeout(t);
  }, [phase, revealIndex, picks.length]);

  useEffect(() => {
    if (phase !== "result") return;
    const t1 = setTimeout(() => setCardsMounted(true), 20);
    const t2 = setTimeout(() => setCountingStarted(true), CARD_ENTRANCE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  useEffect(() => {
    if (picks.length === 0 || completedPlayerIds.size < picks.length) return;
    const t = setTimeout(() => setCommentaryActive(true), COMMENTARY_START_DELAY_MS);
    return () => clearTimeout(t);
  }, [completedPlayerIds, picks.length]);

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

  const maxAverage = Math.max(...round.picks.map((p) => p.average ?? 0));
  const playerById = new Map(state.players.map((p) => [p.id, p]));

  if (phase === "intro") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-8 text-center">
        <div
          className={`transition-all duration-700 ease-out ${
            titleMounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <p className="font-display text-xl font-bold tracking-wide text-secondary">Round {round.roundNumber}</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-accent sm:text-5xl">SON RAUND</h1>
        </div>
        <div className="min-h-[6em] max-w-lg text-xl leading-relaxed">
          {startTyping && (
            <TypewriterText
              text={round.scenarioText}
              msPerChar={FINAL_ROUND_MS_PER_CHAR}
              onComplete={() => setScenarioTyped(true)}
            />
          )}
        </div>
      </main>
    );
  }

  if (phase === "reveal") {
    const revealOrder = [...round.picks].sort((a, b) => (a.average ?? 0) - (b.average ?? 0));
    const clampedIndex = Math.min(revealIndex, revealOrder.length - 1);
    const pick = revealOrder[clampedIndex];
    const player = pick ? playerById.get(pick.playerId) : undefined;
    const isWinnerCard = !!pick && pick.average === maxAverage;

    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-8 text-center">
        <p className="font-display text-xl font-bold tracking-wide text-secondary">
          Son Raund · {clampedIndex + 1} / {revealOrder.length}
        </p>
        {pick && <RevealCard key={pick.playerId} pick={pick} player={player} isWinner={isWinnerCard} />}
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

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="text-center">
        <p className="font-display text-xl font-bold tracking-wide text-secondary">
          {isFinalRound ? "Son Raund Sonucu" : `Round ${round.roundNumber} Sonucu`}
        </p>
        <p className="mt-1 text-lg">{round.scenarioText}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {round.keyAttributes.map((attr) => (
            <span key={attr} className="rounded-none border-2 border-secondary bg-accent-soft px-3 py-1 text-sm text-secondary">
              {isBattleAttributeKey(attr) ? attributeLabel(attr) : attr}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {round.picks.map((pick, gridIndex) => {
          const player = playerById.get(pick.playerId);
          const isWinner = pick.average === maxAverage;
          const isSettled = completedPlayerIds.has(pick.playerId);
          return (
            <div
              key={pick.playerId}
              style={{ transitionDelay: `${gridIndex * 70}ms` }}
              className={`w-full rounded-none border-2 p-3 transition-all duration-300 ease-out sm:w-[calc(50%-0.375rem)] lg:w-[calc(25%-0.5625rem)] ${
                cardsMounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              } ${
                isSettled && isWinner
                  ? "border-accent bg-accent-soft shadow-[4px_4px_0_0_var(--color-accent)]"
                  : "border-line bg-surface"
              }`}
            >
              <p className="text-sm text-secondary-soft">
                {player?.nickname ?? "?"}
                {player?.isBot && " 🤖"}
                {pick.isAutoPick && " (otomatik)"}
              </p>
              <p>{pick.character?.name ?? "?"}</p>
              <p className="mt-1 font-mono text-2xl">
                <AnimatedScoreValue
                  target={pick.average ?? 0}
                  active={countingStarted}
                  durationMs={SCORE_COUNT_MS}
                  onComplete={() =>
                    setCompletedPlayerIds((prev) =>
                      prev.has(pick.playerId) ? prev : new Set(prev).add(pick.playerId),
                    )
                  }
                />
              </p>
              {isSettled && isWinner && (
                <p className="mt-1 font-display text-[0.6rem] tracking-wide text-accent">Round Kazananı</p>
              )}
            </div>
          );
        })}
      </div>

      {round.winnerCommentary && (
        <div className="mx-auto min-h-[3.5em] max-w-lg text-center">
          {commentaryActive && (
            <>
              <p className="text-sm text-secondary-muted">Bilirkişi Yorumu</p>
              <p className="mt-1 text-base italic text-secondary-soft">
                “<TypewriterText text={round.winnerCommentary} msPerChar={COMMENTARY_MS_PER_CHAR} />”
              </p>
            </>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-sm rounded-none border-2 border-line bg-surface p-4">
        <p className="mb-2 text-center text-sm text-secondary-muted">Genel Skor</p>
        <ul className="space-y-1">
          {[...state.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {p.nickname}
                  {p.isBot && " 🤖"}
                </span>
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
          {iAmReady ? "Bekleniyor…" : isFinalRound ? "Nihai Sonucu Gör" : "Devam et"}
        </button>
        <PickWaitingBanner players={state.players} pickedPlayerIds={readyPlayerIds} />
        <CountdownBar remainingMs={remainingMs} durationS={CONTINUE_WINDOW_S} />
      </div>
    </main>
  );
}
