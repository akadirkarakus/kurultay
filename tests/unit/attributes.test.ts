import { describe, expect, it } from "vitest";
import {
  BATTLE_ATTRIBUTES,
  BATTLE_ATTRIBUTE_KEYS,
  attributeLabel,
  isBattleAttributeKey,
} from "@/lib/attributes";

describe("BATTLE_ATTRIBUTES", () => {
  it("has no duplicate keys", () => {
    expect(new Set(BATTLE_ATTRIBUTE_KEYS).size).toBe(BATTLE_ATTRIBUTE_KEYS.length);
  });

  it("has no duplicate Excel headers", () => {
    const headers = BATTLE_ATTRIBUTES.map((a) => a.excelHeader);
    expect(new Set(headers).size).toBe(headers.length);
  });

  it("matches the real column headers found in data/characters.xlsx", () => {
    const headers = BATTLE_ATTRIBUTES.map((a) => a.excelHeader);
    expect(headers).toEqual([
      "Liderlik", "Komiklik", "Karizma", "Hitabet", "Hız", "Fiziksel Güç",
      "Fiziksel Dayanıklılık", "Soğukkanlılık", "Mental Güç", "Yaratıcılık",
      "Vizyonerlik", "Cesaret", "Çalışkanlılık", "Zeka", "Güzellik (görünüş)",
      "Üretkenlik", "Teknoloji Bilgisi", "Komutanlık (savaş)", "Saygınlık",
      "Korkutuculuk", "Gizemlilik", "Sempatiklik", "Öfke", "Şöhret",
      "Zenginlik", "Mütevazılık", "Sabır",
    ]);
  });
});

describe("isBattleAttributeKey / attributeLabel", () => {
  it("accepts real keys and rejects unknown ones", () => {
    expect(isBattleAttributeKey("leadership")).toBe(true);
    expect(isBattleAttributeKey("height_cm")).toBe(false);
    expect(isBattleAttributeKey("not_a_key")).toBe(false);
  });

  it("returns the Turkish label for a valid key", () => {
    expect(attributeLabel("leadership")).toBe("Liderlik");
  });

  it("throws for an invalid key", () => {
    // @ts-expect-error deliberate invalid key for the throw-path test
    expect(() => attributeLabel("nope")).toThrow();
  });
});
