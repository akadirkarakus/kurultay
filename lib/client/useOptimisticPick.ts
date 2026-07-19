"use client";

import { useState } from "react";

/**
 * Generic optimistic-value hook for "click once, lock in immediately,
 * reconcile with server truth later" flows (round picks, category-draft
 * picks). `serverValue` is the authoritative value from the Zustand store
 * (e.g. round.myPick); `submit` performs the actual API call. The caller's
 * component remounts per round/step (via a `key` on the screen component),
 * so there's no stale-state-across-rounds concern to guard against here.
 */
export function useOptimisticPick(
  serverValue: string | null,
  submit: (id: string) => Promise<void>,
) {
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pick(id: string) {
    if (serverValue !== null || optimistic !== null) return; // already locked in
    setError(null);
    setOptimistic(id); // instant UI feedback, before any network round trip
    setSubmitting(true);
    try {
      await submit(id);
    } catch (err) {
      setOptimistic(null); // revert — the request actually failed
      setError(err instanceof Error ? err.message : "İşlem gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return { effectiveValue: serverValue ?? optimistic, error, submitting, pick };
}
