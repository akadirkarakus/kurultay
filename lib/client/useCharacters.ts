"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { CharacterSummary } from "@/types/game";

/**
 * Fetches character details directly via the browser client — safe because
 * `characters` has permissive SELECT RLS (no secrets), so this doesn't need
 * to go through /api/games/[id]/state.
 */
export function useCharacters(ids: readonly string[]): CharacterSummary[] {
  const [fetched, setFetched] = useState<CharacterSummary[]>([]);
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (ids.length === 0) return; // nothing to fetch — see the returned expression below

    let active = true;
    supabaseBrowser()
      .from("characters")
      .select("id, name, category, image_url, attributes")
      .in("id", [...ids])
      .then(({ data }) => {
        if (active) setFetched((data as unknown as CharacterSummary[]) ?? []);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ids.length === 0 ? [] : fetched;
}
