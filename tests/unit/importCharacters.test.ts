import path from "node:path";
import { describe, expect, it } from "vitest";
import { BATTLE_ATTRIBUTE_KEYS } from "@/lib/attributes";
import { MAX_PLAYERS, DRAFT_OFFER_SIZE } from "@/lib/constants";
import { CHARACTER_CATEGORIES } from "@/lib/categories";
import {
  buildCharacterRecord,
  categoryForSheet,
  readCharacterRows,
  slugify,
} from "@/scripts/import-characters";

const EXCEL_PATH = path.join(process.cwd(), "data", "characters.xlsx");

describe("slugify", () => {
  it("lowercases, strips Turkish diacritics, and hyphenates", () => {
    expect(slugify("Recep Tayyip Erdoğan")).toBe("recep-tayyip-erdogan");
    expect(slugify("İnternet Ünlüleri")).toBe("internet-unluleri");
    expect(slugify("Kıvanç Tatlıtuğ")).toBe("kivanc-tatlitug");
  });
});

describe("categoryForSheet", () => {
  it("maps known sheets", () => {
    expect(categoryForSheet("Siyaset")).toBe("politician");
    expect(categoryForSheet("Sporcular")).toBe("athlete");
  });

  it("throws for an unknown sheet", () => {
    expect(() => categoryForSheet("Bilinmeyen")).toThrow(/Unknown sheet/);
  });
});

describe("real data/characters.xlsx", () => {
  const sheetRows = readCharacterRows(EXCEL_PATH).filter(({ row }) =>
    Object.values(row).some((v) => v !== null),
  );

  it("has enough characters in EVERY category for the 4-player draft (§ Sprint 3)", () => {
    const records = sheetRows.map(({ sheetName, row }) => buildCharacterRecord(sheetName, row));
    const countByCategory = new Map<string, number>();
    for (const record of records) {
      countByCategory.set(record.category, (countByCategory.get(record.category) ?? 0) + 1);
    }
    const required = MAX_PLAYERS * DRAFT_OFFER_SIZE;
    for (const category of CHARACTER_CATEGORIES) {
      expect(countByCategory.get(category) ?? 0).toBeGreaterThanOrEqual(required);
    }
  });

  it("builds a valid record for every row with all 27 battle attributes in range", () => {
    for (const { sheetName, row } of sheetRows) {
      const record = buildCharacterRecord(sheetName, row);
      expect(record.name.length).toBeGreaterThan(0);
      expect(record.slug).toMatch(/^[a-z0-9-]+$/);
      for (const key of BATTLE_ATTRIBUTE_KEYS) {
        expect(record.attributes[key]).toBeGreaterThanOrEqual(0);
        expect(record.attributes[key]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("produces unique slugs even for same-named characters in different categories", () => {
    const records = sheetRows.map(({ sheetName, row }) => buildCharacterRecord(sheetName, row));
    const slugs = records.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
