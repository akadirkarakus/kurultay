import "server-only";
import { cache } from "react";
import { ApiError } from "@/lib/errors";
import { readAdminSessionToken } from "@/lib/adminSession";
import type { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export { hashPassword, verifyPassword, burnLoginTiming } from "@/lib/passwordHash";

type AdminClient = ReturnType<typeof supabaseAdmin>;
type AdminUserRow = Database["public"]["Tables"]["admin_users"]["Row"];

/**
 * Resolves the calling admin's identity from the global admin session
 * cookie. Mirrors lib/server/auth.ts's requirePlayer() — every admin route
 * and page calls this (or requireSuperAdmin) first; there is no other
 * authorization mechanism. Wrapped in React's cache() so a layout + page in
 * the same request share one pair of DB round trips (see Next's Data Access
 * Layer guidance) — safe to call repeatedly per request, but never caches
 * across requests since supabaseAdmin() is the memoization key and Next
 * resets React's cache() per request/Route Handler invocation.
 */
export const requireAdmin = cache(async (admin: AdminClient): Promise<AdminUserRow> => {
  const token = await readAdminSessionToken();
  if (!token) {
    throw new ApiError(401, "not_authenticated", "Giriş yapmanız gerekiyor.");
  }

  const { data: session, error: sessionError } = await admin
    .from("admin_sessions")
    .select("admin_user_id, expires_at")
    .eq("token", token)
    .single();

  if (sessionError || !session || new Date(session.expires_at).getTime() < Date.now()) {
    throw new ApiError(401, "not_authenticated", "Oturum geçersiz veya süresi dolmuş.");
  }

  const { data: adminUser, error: userError } = await admin
    .from("admin_users")
    .select("*")
    .eq("id", session.admin_user_id)
    .single();

  if (userError || !adminUser) {
    throw new ApiError(401, "not_authenticated", "Hesap bulunamadı.");
  }

  return adminUser;
});

export async function requireSuperAdmin(admin: AdminClient): Promise<AdminUserRow> {
  const adminUser = await requireAdmin(admin);
  if (!adminUser.is_super_admin) {
    throw new ApiError(403, "forbidden", "Bu işlem için süper admin yetkisi gerekiyor.");
  }
  return adminUser;
}
