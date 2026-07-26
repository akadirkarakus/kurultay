import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { characterUpdateSchema } from "@/lib/validation/adminSchemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, withApiErrorHandling } from "@/lib/errors";
import type { Database, Json } from "@/lib/supabase/types";

type CharacterUpdate = Database["public"]["Tables"]["characters"]["Update"];

export const PATCH = withApiErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = supabaseAdmin();
    await requireAdmin(admin);

    const body = characterUpdateSchema.parse(await req.json());

    const updates: CharacterUpdate = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;

    // attributes is a single jsonb blob — a partial update (one edited cell,
    // or a bulk JSON re-upload) must be merged with the existing value, not
    // overwrite it wholesale. Slug is never recomputed here even if
    // name/category change: the storage image path is keyed off the
    // original slug, so silently changing it would orphan the image.
    if (body.attributes !== undefined) {
      const { data: existing, error: fetchError } = await admin
        .from("characters")
        .select("attributes")
        .eq("id", id)
        .single();
      if (fetchError || !existing) {
        throw new ApiError(404, "character_not_found", "Karakter bulunamadı.");
      }
      updates.attributes = {
        ...(existing.attributes as Record<string, Json>),
        ...body.attributes,
      };
    }

    const { data, error } = await admin
      .from("characters")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ character: data });
  },
);
