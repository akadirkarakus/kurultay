"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/client/adminApi";
import { ApiClientError } from "@/lib/client/http";
import { BATTLE_ATTRIBUTES, SUPPLEMENTARY_FIELDS } from "@/lib/attributes";
import { CATEGORY_LABELS, CHARACTER_CATEGORIES, type CharacterCategory } from "@/lib/categories";
import { characterAttributesJsonSchema } from "@/lib/validation/adminSchemas";

type AttributesSource = "json" | "ai" | null;

export default function NewCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CharacterCategory>(CHARACTER_CATEGORIES[0]);
  const [attributes, setAttributes] = useState<Record<string, number> | null>(null);
  const [attributesSource, setAttributesSource] = useState<AttributesSource>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attributesError, setAttributesError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The admin edits these fields directly after a JSON upload or an AI
  // suggestion populates a baseline — uncontrolled inputs writing into this
  // ref (rather than React state) so every keystroke doesn't re-render the
  // whole 27-field grid, mirroring CharacterTable's editable-cell pattern.
  const attributesRef = useRef<Record<string, number>>({});

  function applyAttributes(next: Record<string, number>, source: AttributesSource) {
    attributesRef.current = { ...next };
    setAttributes(next);
    setAttributesSource(source);
    setAttributesError(null);
  }

  function updateAttributeField(key: string, rawValue: string) {
    if (rawValue.trim() === "") return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    attributesRef.current[key] = value;
  }

  async function handleAttributesFile(file: File) {
    setAttributesError(null);
    try {
      const text = await file.text();
      const parsed = characterAttributesJsonSchema.parse(JSON.parse(text));
      applyAttributes(parsed, "json");
    } catch (err) {
      setAttributesError(err instanceof Error ? `JSON geçersiz: ${err.message}` : "JSON dosyası okunamadı.");
    }
  }

  async function handleAiFill() {
    setAttributesError(null);
    if (!name.trim()) {
      setAttributesError("DeepSeek'in bir şey önerebilmesi için önce isim girin.");
      return;
    }
    setAiLoading(true);
    try {
      const { attributes: suggested } = await adminApi.suggestCharacterAttributes(name.trim(), category);
      applyAttributes(suggested, "ai");
    } catch (err) {
      setAttributesError(err instanceof ApiClientError ? err.message : "DeepSeek önerisi alınamadı.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError("İsim gerekli.");
      return;
    }
    const validated = characterAttributesJsonSchema.safeParse(attributesRef.current);
    if (!attributes || !validated.success) {
      setSubmitError(
        "Geçerli özellik değerleri girilmedi — JSON yükleyin, DeepSeek ile doldurun ya da alanları kontrol edin.",
      );
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("category", category);
    formData.append("attributes", JSON.stringify(validated.data));
    if (imageFile) formData.append("image", imageFile);

    try {
      await adminApi.createCharacter(formData);
      router.push("/admin/characters");
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : "Karakter oluşturulamadı.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-xl tracking-wide">Yeni Karakter</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm text-secondary-soft">
            İsim
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-none border-2 border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-1 block text-sm text-secondary-soft">
            Kategori
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CharacterCategory)}
            className="w-full rounded-none border-2 border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          >
            {CHARACTER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-none border-2 border-line bg-dominant-soft p-4">
          <p className="text-sm text-secondary-soft">
            Özellikleri ({BATTLE_ATTRIBUTES.length} nitelik + boy/yaş) iki yoldan biriyle belirleyin:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="rounded-none border-2 border-secondary bg-surface px-3 py-2 text-xs shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              JSON dosyası yükle
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAttributesFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleAiFill}
              disabled={aiLoading}
              className="rounded-none border-2 border-secondary bg-accent px-3 py-2 text-xs text-white shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {aiLoading ? "DeepSeek düşünüyor…" : "DeepSeek ile Doldur"}
            </button>
            <span className="text-xs text-secondary-soft">
              format için data/character-attributes-template.json
            </span>
          </div>

          {attributesError && <p className="text-sm text-danger">{attributesError}</p>}

          {attributesSource === "ai" && (
            <p className="text-xs text-accent">
              Bu değerler DeepSeek&apos;in tahmini — kaydetmeden önce gözden geçirip düzeltin.
            </p>
          )}

          {attributes && (
            <div className="max-h-96 overflow-y-auto rounded-none border-2 border-line bg-surface p-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {BATTLE_ATTRIBUTES.map((attr) => (
                  <div key={attr.key}>
                    <label className="mb-1 block text-xs text-secondary-soft">{attr.label}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      key={`${attr.key}:${attributes[attr.key]}`}
                      defaultValue={attributes[attr.key] ?? ""}
                      onChange={(e) => updateAttributeField(attr.key, e.target.value)}
                      className="w-full rounded-none border-2 border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  </div>
                ))}
                {SUPPLEMENTARY_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs text-secondary-soft">{field.label}</label>
                    <input
                      type="number"
                      key={`${field.key}:${attributes[field.key]}`}
                      defaultValue={attributes[field.key] ?? ""}
                      onChange={(e) => updateAttributeField(field.key, e.target.value)}
                      className="w-full rounded-none border-2 border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="image" className="mb-1 block text-sm text-secondary-soft">
            Görsel (opsiyonel)
          </label>
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-none border-2 border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
        >
          {submitting ? "Oluşturuluyor…" : "Karakteri oluştur"}
        </button>
      </form>
    </div>
  );
}
