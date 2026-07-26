import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { scenarioSchema } from "@/lib/validation/adminSchemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withApiErrorHandling } from "@/lib/errors";

export const GET = withApiErrorHandling(async () => {
  const admin = supabaseAdmin();
  await requireAdmin(admin);

  const { data, error } = await admin.from("scenarios").select("*").order("text");
  if (error) throw error;
  return NextResponse.json({ scenarios: data });
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const admin = supabaseAdmin();
  await requireAdmin(admin);

  const body = scenarioSchema.parse(await req.json());
  const { data, error } = await admin
    .from("scenarios")
    .insert({ text: body.text, suggested_attributes: body.suggestedAttributes })
    .select()
    .single();
  if (error) throw error;
  return NextResponse.json({ scenario: data }, { status: 201 });
});
