import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { removeStaleCharacterImage, uploadCharacterImage } from "@/lib/server/characterImages";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const POST = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = supabaseAdmin();
    await requireAdmin(admin);

    const { data: character, error: fetchError } = await admin
      .from("characters")
      .select("slug")
      .eq("id", id)
      .single();
    if (fetchError || !character) {
      throw new ApiError(404, "character_not_found", "Karakter bulunamadı.");
    }

    const formData = await req.formData();
    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      throw new ApiError(400, "invalid_request", "image alanı gerekli.");
    }

    const uploaded = await uploadCharacterImage(admin, character.slug, image);
    await removeStaleCharacterImage(admin, character.slug, uploaded.ext);

    const { data, error } = await admin
      .from("characters")
      .update({ image_url: uploaded.url, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ character: data });
  },
);
