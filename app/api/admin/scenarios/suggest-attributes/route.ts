import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { getSuggestedScenarioAttributes } from "@/lib/ai";
import { scenarioTextSchema } from "@/lib/validation/adminSchemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const admin = supabaseAdmin();
  await requireAdmin(admin);

  const body = scenarioTextSchema.parse(await req.json());
  const attributes = await getSuggestedScenarioAttributes(body.text);

  if (!attributes) {
    throw new ApiError(
      502,
      "ai_suggestion_failed",
      "DeepSeek'ten geçerli bir öneri alınamadı — nitelikleri elle seçin ya da tekrar deneyin.",
    );
  }

  return NextResponse.json({ attributes });
});
