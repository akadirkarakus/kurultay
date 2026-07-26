"use client";

import { usePathname } from "next/navigation";
import { BackgroundMusic } from "@/components/shared/BackgroundMusic";
import { VersionBadge } from "@/components/shared/VersionBadge";

/**
 * The game's floating music toggle + version badge, rendered from the root
 * layout so they appear on every game screen. Hidden under /admin — those
 * are internal-tool pages, not game screens, and shouldn't carry game chrome.
 */
export function GameChrome() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <BackgroundMusic />
      <VersionBadge />
    </>
  );
}
