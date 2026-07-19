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

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 rounded-none border-2 border-secondary bg-surface px-3 py-2 text-xs text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      {enabled ? "Müziği Kapat" : "Müziği Aç"}
    </button>
  );
}
