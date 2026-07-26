import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/adminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const DELETE = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = supabaseAdmin();
    const caller = await requireSuperAdmin(admin);

    if (id === caller.id) {
      throw new ApiError(400, "cannot_delete_self", "Kendi hesabınızı silemezsiniz.");
    }

    const { data: target, error: targetError } = await admin
      .from("admin_users")
      .select("is_super_admin")
      .eq("id", id)
      .single();
    if (targetError || !target) {
      throw new ApiError(404, "admin_not_found", "Admin hesabı bulunamadı.");
    }

    if (target.is_super_admin) {
      const { count, error: countError } = await admin
        .from("admin_users")
        .select("*", { count: "exact", head: true })
        .eq("is_super_admin", true);
      if (countError) throw countError;
      if ((count ?? 0) <= 1) {
        throw new ApiError(400, "last_super_admin", "Son süper admin silinemez.");
      }
    }

    const { error } = await admin.from("admin_users").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  },
);
