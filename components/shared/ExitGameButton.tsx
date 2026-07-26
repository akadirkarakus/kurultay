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
      aria-label="Oyundan çık"
      title="Oyundan çık"
      className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-none border-2 border-secondary bg-surface text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
