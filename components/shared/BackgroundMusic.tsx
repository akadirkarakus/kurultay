"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "kurultay-music-enabled";
const MUSIC_SRC = "/music/theme.wav";

// A module-level singleton, not a React-owned ref: this survives any
// remount of the BackgroundMusic component instance (e.g. across a
// client-side route change), so the loop's playback position and
// play/pause state are never reset by React re-rendering the tree.
let sharedAudio: HTMLAudioElement | null = null;
function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio(MUSIC_SRC);
    sharedAudio.loop = true;
    sharedAudio.preload = "none";
  }
  return sharedAudio;
}

/**
 * Mounted once in the root layout so it's present on every page. Starts off
 * by default — browsers block audio autoplay without a prior user gesture
 * anyway, and silent-until-opted-in is the expected pattern for game music.
 */
export function BackgroundMusic() {
  // Derived from the actual shared audio element's live state, not just
  // "was I told to be enabled" — this is what makes it remount-proof.
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !getSharedAudio().paused;
  });

  useEffect(() => {
    // localStorage is a browser-only external store unavailable during SSR,
    // so this can't be a lazy useState initializer without a hydration
    // mismatch (server would always render the "off" label) — reading it
    // once after mount is the correct sync-from-external-system use of an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(STORAGE_KEY) === "true") setEnabled(true);
  }, []);

  useEffect(() => {
    const audio = getSharedAudio();
    if (enabled) {
      audio.play().catch(() => {
        // Autoplay blocked without a user gesture this session — the button
        // stays the source of truth, clicking it again will work.
      });
    } else {
      audio.pause();
    }
  }, [enabled]);

  function toggle() {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const label = enabled ? "Müziği kapat" : "Müziği aç";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="fixed left-16 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-none border-2 border-secondary bg-surface text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      {enabled ? (
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
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
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
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
    </button>
  );
}
