"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "@/lib/client/adminApi";
import { ApiClientError } from "@/lib/client/http";
import { BATTLE_ATTRIBUTES, SUPPLEMENTARY_FIELDS } from "@/lib/attributes";
import { CATEGORY_LABELS, CHARACTER_CATEGORIES } from "@/lib/categories";
import { characterAttributesJsonSchema } from "@/lib/validation/adminSchemas";
import type { AdminCharacter } from "@/types/admin";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface CharacterTableProps {
  initialCharacters: AdminCharacter[];
}

interface RowStatus {
  saving: boolean;
  error: string | null;
}

function errorMessage(err: unknown): string {
  return err instanceof ApiClientError ? err.message : "Kaydedilemedi.";
}

export function CharacterTable({ initialCharacters }: CharacterTableProps) {
  const [characters, setCharacters] = useState<AdminCharacter[]>(initialCharacters);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [pendingArchive, setPendingArchive] = useState<AdminCharacter | null>(null);
  const jsonInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Debounced auto-save state per field (keyed "<characterId>:<fieldKey>").
  // Relying on onBlur alone lost edits when a user typed a value and then
  // immediately reloaded/navigated away before ever clicking out of the
  // field — blur never fires in that case, so nothing was ever sent. Every
  // keystroke (re)schedules a save a short delay later regardless of blur;
  // blur still flushes it immediately for the normal "click away" case.
  const pendingSavesRef = useRef<Record<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>>(
    {},
  );

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (Object.keys(pendingSavesRef.current).length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  function scheduleFieldSave(fieldKey: string, run: () => void, delayMs = 600) {
    const pending = pendingSavesRef.current[fieldKey];
    if (pending) clearTimeout(pending.timer);
    const timer = setTimeout(() => {
      delete pendingSavesRef.current[fieldKey];
      run();
    }, delayMs);
    pendingSavesRef.current[fieldKey] = { timer, run };
  }

  function flushFieldSave(fieldKey: string) {
    const pending = pendingSavesRef.current[fieldKey];
    if (!pending) return;
    clearTimeout(pending.timer);
    delete pendingSavesRef.current[fieldKey];
    pending.run();
  }

  function setStatus(id: string, status: RowStatus) {
    setRowStatus((prev) => ({ ...prev, [id]: status }));
  }

  function patchLocal(id: string, patch: Partial<AdminCharacter>) {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function refetch(nextIncludeArchived: boolean) {
    const { characters: fetched } = await adminApi.listCharacters(nextIncludeArchived);
    setCharacters(fetched);
  }

  async function toggleIncludeArchived() {
    const next = !includeArchived;
    setIncludeArchived(next);
    await refetch(next);
  }

  async function saveField(
    character: AdminCharacter,
    body: { name?: string; category?: string; attributes?: Record<string, number> },
    optimisticPatch: Partial<AdminCharacter>,
    revertPatch: Partial<AdminCharacter>,
  ) {
    setStatus(character.id, { saving: true, error: null });
    patchLocal(character.id, optimisticPatch);
    try {
      const { character: updated } = await adminApi.updateCharacter(character.id, body);
      setCharacters((prev) => prev.map((c) => (c.id === character.id ? updated : c)));
      setStatus(character.id, { saving: false, error: null });
    } catch (err) {
      patchLocal(character.id, revertPatch);
      setStatus(character.id, { saving: false, error: errorMessage(err) });
    }
  }

  function commitName(character: AdminCharacter, value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === character.name) return;
    void saveField(character, { name: trimmed }, { name: trimmed }, { name: character.name });
  }

  function handleNameChange(character: AdminCharacter, value: string) {
    scheduleFieldSave(`${character.id}:name`, () => commitName(character, value));
  }

  function handleCategoryChange(character: AdminCharacter, value: string) {
    if (value === character.category) return;
    void saveField(character, { category: value }, { category: value }, { category: character.category });
  }

  function commitAttribute(character: AdminCharacter, key: string, rawValue: string) {
    if (rawValue.trim() === "") return;
    const value = Number(rawValue);
    const previous = character.attributes[key];
    if (!Number.isFinite(value) || value === previous) return;
    const nextAttributes = { ...character.attributes, [key]: value };
    void saveField(
      character,
      { attributes: { [key]: value } },
      { attributes: nextAttributes },
      { attributes: { ...nextAttributes, [key]: previous } },
    );
  }

  function handleAttributeChange(character: AdminCharacter, key: string, rawValue: string) {
    scheduleFieldSave(`${character.id}:${key}`, () => commitAttribute(character, key, rawValue));
  }

  async function handleImageChange(character: AdminCharacter, file: File) {
    setStatus(character.id, { saving: true, error: null });
    try {
      const { character: updated } = await adminApi.uploadCharacterImage(character.id, file);
      setCharacters((prev) => prev.map((c) => (c.id === character.id ? updated : c)));
      setStatus(character.id, { saving: false, error: null });
    } catch (err) {
      setStatus(character.id, { saving: false, error: errorMessage(err) });
    }
  }

  async function handleJsonUpload(character: AdminCharacter, file: File) {
    setStatus(character.id, { saving: true, error: null });
    try {
      const text = await file.text();
      const parsed = characterAttributesJsonSchema.parse(JSON.parse(text));
      const { character: updated } = await adminApi.updateCharacter(character.id, { attributes: parsed });
      setCharacters((prev) => prev.map((c) => (c.id === character.id ? updated : c)));
      setStatus(character.id, { saving: false, error: null });
    } catch {
      setStatus(character.id, { saving: false, error: "Geçersiz JSON dosyası." });
    }
  }

  async function handleArchiveConfirm() {
    if (!pendingArchive) return;
    const character = pendingArchive;
    setPendingArchive(null);
    try {
      if (character.is_active) {
        await adminApi.archiveCharacter(character.id);
      } else {
        await adminApi.unarchiveCharacter(character.id);
      }
      await refetch(includeArchived);
    } catch (err) {
      setStatus(character.id, { saving: false, error: errorMessage(err) });
    }
  }

  const filtered = useMemo(() => {
    return characters.filter((c) => {
      if (filterCategory && c.category !== filterCategory) return false;
      if (filterText && !c.name.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }, [characters, filterCategory, filterText]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="İsme göre filtrele…"
          className="rounded-none border-2 border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-none border-2 border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Tüm kategoriler</option>
          {CHARACTER_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-secondary-soft">
          <input type="checkbox" checked={includeArchived} onChange={toggleIncludeArchived} />
          Arşivlenmişleri göster
        </label>
        <span className="text-sm text-secondary-soft">{filtered.length} karakter</span>
      </div>

      <div className="overflow-x-auto rounded-none border-2 border-line">
        <table className="w-full border-collapse bg-surface text-sm">
          <thead>
            <tr className="border-b-2 border-line bg-dominant-soft">
              <th className="sticky left-0 z-10 whitespace-nowrap bg-dominant-soft px-3 py-2 text-left">
                Karakter
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left">Kategori</th>
              {BATTLE_ATTRIBUTES.map((attr) => (
                <th key={attr.key} className="whitespace-nowrap px-2 py-2 text-left">
                  {attr.label}
                </th>
              ))}
              {SUPPLEMENTARY_FIELDS.map((field) => (
                <th key={field.key} className="whitespace-nowrap px-2 py-2 text-left">
                  {field.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2 text-left">JSON</th>
              <th className="whitespace-nowrap px-3 py-2 text-left">Arşiv</th>
              <th className="whitespace-nowrap px-3 py-2 text-left">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((character) => {
              const status = rowStatus[character.id];
              return (
                <tr key={character.id} className="border-b border-line align-middle">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => imageInputRefs.current[character.id]?.click()}
                        className="h-10 w-10 shrink-0 overflow-hidden rounded-none border-2 border-line bg-dominant-soft"
                        title="Görseli değiştir"
                      >
                        {character.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={character.image_url}
                            alt={character.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </button>
                      <input
                        ref={(el) => {
                          imageInputRefs.current[character.id] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleImageChange(character, file);
                          e.target.value = "";
                        }}
                      />
                      <input
                        key={`${character.id}:${character.name}`}
                        defaultValue={character.name}
                        onChange={(e) => handleNameChange(character, e.target.value)}
                        onBlur={() => flushFieldSave(`${character.id}:name`)}
                        className="w-36 rounded-none border-2 border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={character.category}
                      onChange={(e) => handleCategoryChange(character, e.target.value)}
                      className="rounded-none border-2 border-line bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                    >
                      {CHARACTER_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </td>
                  {BATTLE_ATTRIBUTES.map((attr) => (
                    <td key={attr.key} className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        key={`${character.id}:${attr.key}:${character.attributes[attr.key]}`}
                        defaultValue={character.attributes[attr.key] ?? ""}
                        onChange={(e) => handleAttributeChange(character, attr.key, e.target.value)}
                        onBlur={() => flushFieldSave(`${character.id}:${attr.key}`)}
                        className="w-16 rounded-none border-2 border-line px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    </td>
                  ))}
                  {SUPPLEMENTARY_FIELDS.map((field) => (
                    <td key={field.key} className="px-2 py-2">
                      <input
                        type="number"
                        key={`${character.id}:${field.key}:${character.attributes[field.key]}`}
                        defaultValue={character.attributes[field.key] ?? ""}
                        onChange={(e) => handleAttributeChange(character, field.key, e.target.value)}
                        onBlur={() => flushFieldSave(`${character.id}:${field.key}`)}
                        className="w-16 rounded-none border-2 border-line px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => jsonInputRefs.current[character.id]?.click()}
                      className="whitespace-nowrap rounded-none border-2 border-secondary bg-dominant-soft px-2 py-1 text-xs shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      JSON Yükle
                    </button>
                    <input
                      ref={(el) => {
                        jsonInputRefs.current[character.id] = el;
                      }}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleJsonUpload(character, file);
                        e.target.value = "";
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setPendingArchive(character)}
                      className={`whitespace-nowrap rounded-none border-2 border-secondary px-2 py-1 text-xs shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                        character.is_active ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
                      }`}
                    >
                      {character.is_active ? "Arşivle" : "Arşivden çıkar"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {status?.saving && <span className="text-secondary-soft">Kaydediliyor…</span>}
                    {status?.error && (
                      <span className="text-danger" title={status.error}>
                        Hata
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingArchive !== null}
        title={pendingArchive?.is_active ? "Karakteri arşivle" : "Karakteri arşivden çıkar"}
        message={
          pendingArchive?.is_active
            ? `"${pendingArchive?.name}" arşivlenecek ve yeni oyunlarda teklif edilmeyecek. Geçmiş oyunlar etkilenmez.`
            : `"${pendingArchive?.name}" yeniden aktif edilecek ve yeni oyunlarda tekrar teklif edilebilecek.`
        }
        confirmLabel={pendingArchive?.is_active ? "Arşivle" : "Arşivden çıkar"}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  );
}
