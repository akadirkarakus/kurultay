import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Plain factory with no "server-only" guard, so it can be used both from
 * lib/supabase/admin.ts (Next.js server code) and from standalone tsx
 * scripts (scripts/*.ts), which run outside Next's bundler and would crash
 * immediately on `import "server-only"` (it throws unconditionally unless
 * a bundler swaps it for its no-op "react-server" build).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
