import "server-only";
import { ApiError } from "@/lib/errors";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

// Mirrors the extension convention from scripts/import-characters.ts:
// flat "<slug>.<ext>" storage paths in the "character-images" bucket.
const EXT_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadCharacterImage(
  admin: AdminClient,
  slug: string,
  file: File,
): Promise<{ url: string; ext: string }> {
  const ext = EXT_BY_MIME_TYPE[file.type];
  if (!ext) {
    throw new ApiError(400, "invalid_image_type", "Görsel jpeg, png veya webp formatında olmalı.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError(400, "image_too_large", "Görsel en fazla 5MB olabilir.");
  }

  const storagePath = `${slug}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("character-images")
    .upload(storagePath, buffer, { upsert: true, contentType: file.type });
  if (error) {
    throw new ApiError(500, "image_upload_failed", `Görsel yüklenemedi: ${error.message}`);
  }

  const { data } = admin.storage.from("character-images").getPublicUrl(storagePath);
  return { url: data.publicUrl, ext };
}

/**
 * Best-effort cleanup after a successful re-upload with a different
 * extension than before (e.g. replacing a .jpg with a .png) — logs and
 * continues on failure rather than failing the request, since an orphaned
 * storage object is harmless clutter, not a correctness problem.
 */
export async function removeStaleCharacterImage(
  admin: AdminClient,
  slug: string,
  keepExt: string,
): Promise<void> {
  const staleExts = Object.values(EXT_BY_MIME_TYPE).filter((ext) => ext !== keepExt);
  const { error } = await admin.storage
    .from("character-images")
    .remove(staleExts.map((ext) => `${slug}.${ext}`));
  if (error) {
    console.error(`Failed to clean up stale image(s) for "${slug}":`, error.message);
  }
}
