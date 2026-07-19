/**
 * The battle attribute set is derived 1:1 from the real column headers in
 * data/characters.xlsx (see scripts/import-characters.ts). These are NOT the
 * illustrative names from the original spec — they reflect the actual sheet.
 * `excelHeader` is the exact Turkish column header used to look up the value
 * when importing; `label` is the Turkish label shown in the UI.
 */
export const BATTLE_ATTRIBUTES = [
  { key: "leadership", excelHeader: "Liderlik", label: "Liderlik" },
  { key: "humor", excelHeader: "Komiklik", label: "Komiklik" },
  { key: "charisma", excelHeader: "Karizma", label: "Karizma" },
  { key: "public_speaking", excelHeader: "Hitabet", label: "Hitabet" },
  { key: "speed", excelHeader: "Hız", label: "Hız" },
  { key: "physical_strength", excelHeader: "Fiziksel Güç", label: "Fiziksel Güç" },
  { key: "physical_endurance", excelHeader: "Fiziksel Dayanıklılık", label: "Fiziksel Dayanıklılık" },
  { key: "composure", excelHeader: "Soğukkanlılık", label: "Soğukkanlılık" },
  { key: "mental_strength", excelHeader: "Mental Güç", label: "Mental Güç" },
  { key: "creativity", excelHeader: "Yaratıcılık", label: "Yaratıcılık" },
  { key: "vision", excelHeader: "Vizyonerlik", label: "Vizyonerlik" },
  { key: "courage", excelHeader: "Cesaret", label: "Cesaret" },
  { key: "diligence", excelHeader: "Çalışkanlılık", label: "Çalışkanlılık" },
  { key: "intelligence", excelHeader: "Zeka", label: "Zeka" },
  { key: "attractiveness", excelHeader: "Güzellik (görünüş)", label: "Güzellik" },
  { key: "productivity", excelHeader: "Üretkenlik", label: "Üretkenlik" },
  { key: "technical_knowledge", excelHeader: "Teknoloji Bilgisi", label: "Teknoloji Bilgisi" },
  { key: "command", excelHeader: "Komutanlık (savaş)", label: "Komutanlık" },
  { key: "respectability", excelHeader: "Saygınlık", label: "Saygınlık" },
  { key: "intimidation", excelHeader: "Korkutuculuk", label: "Korkutuculuk" },
  { key: "mystery", excelHeader: "Gizemlilik", label: "Gizemlilik" },
  { key: "likability", excelHeader: "Sempatiklik", label: "Sempatiklik" },
  { key: "temper", excelHeader: "Öfke", label: "Öfke" },
  { key: "fame", excelHeader: "Şöhret", label: "Şöhret" },
  { key: "wealth", excelHeader: "Zenginlik", label: "Zenginlik" },
  { key: "humility", excelHeader: "Mütevazılık", label: "Mütevazılık" },
  { key: "patience", excelHeader: "Sabır", label: "Sabır" },
] as const;

export type BattleAttributeKey = (typeof BATTLE_ATTRIBUTES)[number]["key"];

export const BATTLE_ATTRIBUTE_KEYS: readonly BattleAttributeKey[] = BATTLE_ATTRIBUTES.map(
  (a) => a.key,
);

const LABEL_BY_KEY = new Map(BATTLE_ATTRIBUTES.map((a) => [a.key, a.label]));

export function isBattleAttributeKey(value: string): value is BattleAttributeKey {
  return LABEL_BY_KEY.has(value as BattleAttributeKey);
}

export function attributeLabel(key: BattleAttributeKey): string {
  const label = LABEL_BY_KEY.get(key);
  if (!label) throw new Error(`Unknown attribute key: ${key}`);
  return label;
}

/**
 * Supplementary character fields present in the source spreadsheet
 * (height in cm, age in years). These are NOT 0-100 skill scores and are
 * never eligible as a round's "key attribute" — they're display-only flavor
 * stats stored alongside the battle attributes in `characters.attributes`.
 */
export const SUPPLEMENTARY_FIELDS = [
  { key: "height_cm", excelHeader: "Boy", label: "Boy (cm)" },
  { key: "age", excelHeader: "Yaş", label: "Yaş" },
] as const;
