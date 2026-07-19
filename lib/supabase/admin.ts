import "server-only";
import { createAdminClient } from "./create-admin-client";

let client: ReturnType<typeof createAdminClient> | null = null;

/**
 * Service-role Supabase client. Bypasses RLS entirely — this is the only
 * client allowed to perform inserts/updates/deletes anywhere in the app.
 * Never import this file from client components.
 */
export function supabaseAdmin() {
  if (!client) client = createAdminClient();
  return client;
}
