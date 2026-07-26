import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { uploadCharacterImage } from "@/lib/server/characterImages";
import {
  characterAttributesJsonSchema,
  characterMetaSchema,
} from "@/lib/validation/adminSchemas";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";

export const GET = withApiErrorHandling(async (req: NextRequest) => {
  const admin = supabaseAdmin();
  await requireAdmin(admin);

  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
  let query = admin.from("characters").select("*").order("name");
  if (!includeArchived) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ characters: data });
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const admin = supabaseAdmin();
  await requireAdmin(admin);

  const formData = await req.formData();
  const name = formData.get("name");
  const category = formData.get("category");
  const attributesRaw = formData.get("attributes");
  const image = formData.get("image");

  if (typeof name !== "string" || typeof category !== "string" || typeof attributesRaw !== "string") {
    throw new ApiError(400, "invalid_request", "name, category ve attributes alanları gerekli.");
  }

  const meta = characterMetaSchema.parse({ name, category });

  let parsedAttributes: unknown;
  try {
    parsedAttributes = JSON.parse(attributesRaw);
  } catch {
    throw new ApiError(400, "invalid_json", "attributes alanı geçerli bir JSON değil.");
  }
  const attributes = characterAttributesJsonSchema.parse(parsedAttributes);

  const slug = slugify(`${meta.category}-${meta.name}`);

  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadCharacterImage(admin, slug, image);
    imageUrl = uploaded.url;
  }

  const { data, error } = await admin
    .from("characters")
    .insert({ slug, name: meta.name, category: meta.category, attributes, image_url: imageUrl })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(
        409,
        "slug_conflict",
        "Bu isim ve kategoriyle zaten bir karakter var — ismi biraz farklılaştırın.",
      );
    }
    throw error;
  }

  return NextResponse.json({ character: data }, { status: 201 });
});
