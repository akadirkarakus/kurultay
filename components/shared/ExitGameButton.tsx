"use client";

import { useRouter } from "next/navigation";

/**
 * Purely a client-side navigation — no server call. The session cookie for
 * this room stays valid (see lib/session.ts), so leaving is non-destructive:
 * a player can always return via the room URL, and the server already
 * tolerates an absent player through the existing pick-deadline/auto-pick
 * fallbacks (autoFillDraftStragglers, resolve_round's auto-pick).
 */
export function ExitGameButton() {
  const router = useRouter();

  function handleExit() {
    if (confirm("Oyundan çıkmak istediğine emin misin?")) {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      className="fixed left-4 top-4 z-50 rounded-none border-2 border-secondary bg-surface px-3 py-2 text-xs text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      Oyundan Çık
    </button>
  );
}
