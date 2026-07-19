import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as XLSX from "xlsx";
import { BATTLE_ATTRIBUTES, SUPPLEMENTARY_FIELDS } from "@/lib/attributes";
import { MAX_PLAYERS, DRAFT_OFFER_SIZE } from "@/lib/constants";
import { CHARACTER_CATEGORIES } from "@/lib/categories";
import { createAdminClient } from "@/lib/supabase/create-admin-client";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

/**
 * Maps each sheet in data/characters.xlsx to a character category. Sheets
 * not listed here cause the import to fail fast rather than silently
 * mis-categorizing new content — add new sheets here deliberately.
 */
const CATEGORY_BY_SHEET: Record<string, string> = {
  Siyaset: "politician",
  Tarihi: "historical",
  Oyuncu: "actor",
  "Film Karakterleri": "movie_character",
  "Dizi Karakterleri": "tv_character",
  "İnternet Ünlüleri": "internet_celebrity",
  Sporcular: "athlete",
  Sanatçılar: "artist",
  Ünlüler: "celebrity",
};

const TURKISH_CHAR_MAP: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
  ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c",
};

export function slugify(text: string): string {
  const replaced = [...text].map((ch) => TURKISH_CHAR_MAP[ch] ?? ch).join("");
  return replaced
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryForSheet(sheetName: string): string {
  const category = CATEGORY_BY_SHEET[sheetName];
  if (!category) {
    throw new Error(
      `Unknown sheet "${sheetName}" — add it to CATEGORY_BY_SHEET in scripts/import-characters.ts before importing.`,
    );
  }
  return category;
}

export interface SheetRow {
  sheetName: string;
  row: Record<string, unknown>;
}

export function readCharacterRows(filePath: string): SheetRow[] {
  const workbook = XLSX.read(readFileSync(filePath));
  const rows: SheetRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: null },
    );
    for (const row of sheetRows) rows.push({ sheetName, row });
  }
  return rows;
}

export interface CharacterRecord {
  slug: string;
  name: string;
  category: string;
  attributes: Record<string, number>;
}

export function buildCharacterRecord(sheetName: string, row: Record<string, unknown>): CharacterRecord {
  const category = categoryForSheet(sheetName);
  const name = row["Karakter"];
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error(`[${sheetName}] Row is missing a "Karakter" (name) value: ${JSON.stringify(row)}`);
  }

  const attributes: Record<string, number> = {};
  for (const attr of BATTLE_ATTRIBUTES) {
    const raw = row[attr.excelHeader];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(
        `[${sheetName}] "${name}" is missing a numeric value for "${attr.excelHeader}" (${attr.key}): got ${JSON.stringify(raw)}`,
      );
    }
    if (raw < 0 || raw > 100) {
      throw new Error(
        `[${sheetName}] "${name}" has an out-of-range value for "${attr.excelHeader}" (${attr.key}): ${raw} (must be 0-100)`,
      );
    }
    attributes[attr.key] = raw;
  }

  for (const field of SUPPLEMENTARY_FIELDS) {
    const raw = row[field.excelHeader];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      attributes[field.key] = raw;
    }
    // Supplementary fields are optional and not range-checked — they're
    // display-only flavor stats (height in cm, age in years), never used
    // as a round's key attribute.
  }

  return { slug: slugify(`${category}-${name}`), name, category, attributes };
}

function resolveImagePath(slug: string, imagesDir: string): string | null {
  if (!existsSync(imagesDir)) return null;
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const candidate = path.join(imagesDir, `${slug}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
  filePath: string,
): Promise<string> {
  const ext = path.extname(filePath).slice(1);
  const storagePath = `${slug}.${ext}`;
  const fileBuffer = readFileSync(filePath);
  const { error } = await admin
    .storage.from("character-images")
    .upload(storagePath, fileBuffer, { upsert: true, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });
  if (error) throw new Error(`Failed to upload image for "${slug}": ${error.message}`);
  const { data } = admin.storage.from("character-images").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  const excelPath = path.join(dataDir, "characters.xlsx");
  const imagesDir = path.join(dataDir, "character-images");

  if (!existsSync(excelPath)) {
    throw new Error(`Expected character data at ${excelPath} — see Kurultay-steps.md.`);
  }

  const sheetRows = readCharacterRows(excelPath);
  const records = sheetRows
    .filter(({ row }) => Object.values(row).some((v) => v !== null))
    .map(({ sheetName, row }) => buildCharacterRecord(sheetName, row));

  // The category draft (Sprint 3) needs MAX_PLAYERS * DRAFT_OFFER_SIZE
  // disjoint characters available WITHIN EACH of the 5 categories drafted
  // per game — check every known category, not just the aggregate total.
  const requiredPerCategory = MAX_PLAYERS * DRAFT_OFFER_SIZE;
  const countByCategory = new Map<string, number>();
  for (const record of records) {
    countByCategory.set(record.category, (countByCategory.get(record.category) ?? 0) + 1);
  }
  for (const category of CHARACTER_CATEGORIES) {
    const count = countByCategory.get(category) ?? 0;
    if (count < requiredPerCategory) {
      console.warn(
        `WARNING: category "${category}" has only ${count} character(s); a ${MAX_PLAYERS}-player game needs at least ${requiredPerCategory} (${MAX_PLAYERS} x ${DRAFT_OFFER_SIZE} disjoint draft offers) if this category is chosen. Add more rows before running a full game.`,
      );
    }
  }

  const admin = createAdminClient();

  let missingImages = 0;
  const rowsToUpsert = [];
  for (const record of records) {
    const imagePath = resolveImagePath(record.slug, imagesDir);
    let imageUrl: string | null = null;
    if (imagePath) {
      imageUrl = await uploadImage(admin, record.slug, imagePath);
    } else {
      missingImages++;
    }
    rowsToUpsert.push({
      slug: record.slug,
      name: record.name,
      category: record.category,
      attributes: record.attributes,
      image_url: imageUrl,
    });
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
    const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
    const { error } = await admin.from("characters").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`Upsert failed for batch starting at row ${i}: ${error.message}`);
  }

  console.log(`Imported ${rowsToUpsert.length} characters across ${Object.keys(CATEGORY_BY_SHEET).length} categories.`);
  if (missingImages > 0) {
    console.warn(
      `WARNING: ${missingImages} character(s) have no image (no matching file in ${imagesDir}). ` +
        `The game requires every character to have an image — add files named "<slug>.jpg" (see console output above for slugs) and re-run this script; it's safe to re-run any time.`,
    );
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
