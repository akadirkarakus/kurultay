import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Anon-key Supabase client for the browser. Used only for Realtime
 * (Postgres Changes on public tables, Presence, Broadcast) and for reading
 * the handful of tables with permissive RLS (characters, scenarios, games,
 * rounds, game_players_public). Never used for mutations.
 */
export function supabaseBrowser() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  client = createClient<Database>(url, anonKey);
  return client;
}
