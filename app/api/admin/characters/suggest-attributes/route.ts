import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { getSuggestedCharacterAttributes } from "@/lib/ai";
import { characterMetaSchema } from "@/lib/validation/adminSchemas";
import { CATEGORY_LABELS } from "@/lib/categories";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const admin = supabaseAdmin();
  await requireAdmin(admin);

  const body = characterMetaSchema.parse(await req.json());
  const attributes = await getSuggestedCharacterAttributes(body.name, CATEGORY_LABELS[body.category]);

  if (!attributes) {
    throw new ApiError(
      502,
      "ai_suggestion_failed",
      "DeepSeek'ten geçerli bir öneri alınamadı — değerleri elle girin ya da tekrar deneyin.",
    );
  }

  return NextResponse.json({ attributes });
});
