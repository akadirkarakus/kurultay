import { NextResponse } from "next/server";
import { clearAdminSessionCookie, readAdminSessionToken } from "@/lib/adminSession";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(async () => {
  const token = await readAdminSessionToken();
  if (token) {
    await supabaseAdmin().from("admin_sessions").delete().eq("token", token);
  }
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
});
