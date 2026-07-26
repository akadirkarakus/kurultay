"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/client/adminApi";
import { ApiClientError } from "@/lib/client/http";
import { BATTLE_ATTRIBUTES, SUPPLEMENTARY_FIELDS } from "@/lib/attributes";
import { CATEGORY_LABELS, CHARACTER_CATEGORIES, type CharacterCategory } from "@/lib/categories";
import { characterAttributesJsonSchema } from "@/lib/validation/adminSchemas";

export default function NewCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CharacterCategory>(CHARACTER_CATEGORIES[0]);
  const [parsedAttributes, setParsedAttributes] = useState<Record<string, number> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAttributesFile(file: File) {
    setJsonError(null);
    setParsedAttributes(null);
    try {
      const text = await file.text();
      const parsed = characterAttributesJsonSchema.parse(JSON.parse(text));
      setParsedAttributes(parsed);
    } catch (err) {
      setJsonError(err instanceof Error ? `JSON geçersiz: ${err.message}` : "JSON dosyası okunamadı.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError("İsim gerekli.");
      return;
    }
    if (!parsedAttributes) {
      setSubmitError("Geçerli bir özellik JSON dosyası yükleyin.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("category", category);
    formData.append("attributes", JSON.stringify(parsedAttributes));
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
    <div className="max-w-2xl space-y-6">
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

        <div>
          <label htmlFor="attributes" className="mb-1 block text-sm text-secondary-soft">
            Özellik JSON dosyası ({BATTLE_ATTRIBUTES.length} nitelik + boy/yaş) — format için repodaki
            data/character-attributes-template.json dosyasına bakın
          </label>
          <input
            id="attributes"
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAttributesFile(file);
            }}
            className="w-full rounded-none border-2 border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
          />
          {jsonError && <p className="mt-1 text-sm text-danger">{jsonError}</p>}
          {parsedAttributes && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-none border-2 border-line bg-dominant-soft p-3 text-xs">
              <p className="mb-1 font-display tracking-wide text-secondary">Önizleme</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {BATTLE_ATTRIBUTES.map((attr) => (
                  <li key={attr.key}>
                    {attr.label}: {parsedAttributes[attr.key]}
                  </li>
                ))}
                {SUPPLEMENTARY_FIELDS.map((field) =>
                  parsedAttributes[field.key] !== undefined ? (
                    <li key={field.key}>
                      {field.label}: {parsedAttributes[field.key]}
                    </li>
                  ) : null,
                )}
              </ul>
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
