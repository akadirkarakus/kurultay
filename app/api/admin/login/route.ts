import { NextRequest, NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/validation/adminSchemas";
import { burnLoginTiming, verifyPassword } from "@/lib/server/adminAuth";
import { generateSessionToken } from "@/lib/session";
import { ADMIN_SESSION_MAX_AGE_SECONDS, setAdminSessionCookie } from "@/lib/adminSession";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = adminLoginSchema.parse(await req.json());
  const admin = supabaseAdmin();

  const { data: adminUser } = await admin
    .from("admin_users")
    .select("*")
    .eq("username", body.username)
    .maybeSingle();

  if (!adminUser) {
    await burnLoginTiming(body.password);
    throw new ApiError(401, "invalid_credentials", "Kullanıcı adı veya şifre hatalı.");
  }

  const valid = await verifyPassword(body.password, adminUser.password_hash);
  if (!valid) {
    throw new ApiError(401, "invalid_credentials", "Kullanıcı adı veya şifre hatalı.");
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const { error } = await admin
    .from("admin_sessions")
    .insert({ admin_user_id: adminUser.id, token, expires_at: expiresAt });
  if (error) throw error;

  await setAdminSessionCookie(token);

  return NextResponse.json({ username: adminUser.username, isSuperAdmin: adminUser.is_super_admin });
});
