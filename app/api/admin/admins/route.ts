import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireSuperAdmin } from "@/lib/server/adminAuth";
import { adminAccountCreateSchema } from "@/lib/validation/adminSchemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

const PUBLIC_COLUMNS = "id, username, is_super_admin, created_at";

export const GET = withApiErrorHandling(async () => {
  const admin = supabaseAdmin();
  await requireSuperAdmin(admin);

  const { data, error } = await admin
    .from("admin_users")
    .select(PUBLIC_COLUMNS)
    .order("created_at");
  if (error) throw error;
  return NextResponse.json({ admins: data });
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const admin = supabaseAdmin();
  await requireSuperAdmin(admin);

  const body = adminAccountCreateSchema.parse(await req.json());
  const passwordHash = await hashPassword(body.password);

  const { data, error } = await admin
    .from("admin_users")
    .insert({ username: body.username, password_hash: passwordHash, is_super_admin: body.isSuperAdmin })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(409, "username_taken", "Bu kullanıcı adı zaten kullanılıyor.");
    }
    throw error;
  }

  return NextResponse.json({ admin: data }, { status: 201 });
});
