import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = supabaseAdmin();
    await requireAdmin(admin);

    const { data, error } = await admin
      .from("characters")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ character: data });
  },
);
