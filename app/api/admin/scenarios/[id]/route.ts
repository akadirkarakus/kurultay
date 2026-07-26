import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { scenarioSchema } from "@/lib/validation/adminSchemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withApiErrorHandling } from "@/lib/errors";

export const PATCH = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = supabaseAdmin();
    await requireAdmin(admin);

    const body = scenarioSchema.parse(await req.json());
    const { data, error } = await admin
      .from("scenarios")
      .update({ text: body.text, suggested_attributes: body.suggestedAttributes })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ scenario: data });
  },
);

// Safe to hard-delete: no FK references scenarios.id anywhere (rounds stores
// a denormalized copy of scenario_text/key_attributes, not a scenario_id).
export const DELETE = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = supabaseAdmin();
    await requireAdmin(admin);

    const { error } = await admin.from("scenarios").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  },
);
