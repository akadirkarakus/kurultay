"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { api } from "@/lib/client/api";
import { DRAFT_STEP_DURATION_S } from "@/lib/constants";
import { useCharacters } from "@/lib/client/useCharacters";
import { useOptimisticPick } from "@/lib/client/useOptimisticPick";
import { CharacterCard } from "@/components/CharacterCard";
import { PickWaitingBanner } from "@/components/shared/PickWaitingBanner";
import { CountdownBar } from "@/components/shared/CountdownBar";
import { CATEGORY_LABELS, isCharacterCategory } from "@/lib/categories";

export function CategoryDraftScreen({ gameId }: { gameId: string }) {
  const state = useGameStore((s) => s.state)!;
  const draft = state.draft;
  const picksSoFar = useCharacters(draft?.myPicksSoFar ?? []);

  const deadlineAt = draft?.deadlineAt ?? null;

  // Lazy initializer (not a synchronous setState-in-effect call) — correct
  // on first render because this component remounts per step (see the
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
    // Once our cosmetic countdown hits zero, ask the server to auto-fill
    // stragglers and advance — it independently re-checks the real
    // deadline, so this can't be used to shortcut the step.
    if (remainingMs === 0) {
      api.resolveDraftStep(gameId).catch(() => {});
    }
  }, [remainingMs, gameId]);

  const {
    effectiveValue: myPick,
    error,
    submitting,
    pick,
  } = useOptimisticPick(draft?.myPickForCurrentStep ?? null, async (id) => {
    await api.submitDraftPick(gameId, id);
  });

  if (!draft) {
    return (
      <main className="flex flex-1 items-center justify-center text-secondary-soft">Yükleniyor…</main>
    );
  }

  const categoryLabel =
    draft.category && isCharacterCategory(draft.category) ? CATEGORY_LABELS[draft.category] : draft.category;

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-secondary-muted">
          Kategori {draft.stepNumber}/{draft.totalSteps}
        </p>
        <p className="mt-2 font-display text-sm tracking-wide">{categoryLabel}</p>
        <CountdownBar remainingMs={remainingMs} durationS={DRAFT_STEP_DURATION_S} />
      </div>

      {picksSoFar.length > 0 && (
        <div className="mx-auto flex flex-wrap justify-center gap-2">
          {picksSoFar.map((c) => (
            <span key={c.id} className="rounded-none border-2 border-line bg-dominant-soft px-3 py-1 text-sm text-secondary">
              {c.name}
            </span>
          ))}
        </div>
      )}

      <PickWaitingBanner players={state.players} pickedPlayerIds={draft.pickedPlayerIds} />

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      {myPick !== null ? (
        <p className="text-center text-secondary-soft">Seçimin gönderildi. Diğer oyuncular bekleniyor…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {draft.myOffer.map((c) => (
            <CharacterCard key={c.id} character={c} disabled={submitting} onClick={() => pick(c.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
