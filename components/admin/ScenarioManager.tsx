"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/lib/client/adminApi";
import { ApiClientError } from "@/lib/client/http";
import { BATTLE_ATTRIBUTES, attributeLabel, type BattleAttributeKey } from "@/lib/attributes";
import { KEY_ATTRIBUTES_PER_ROUND } from "@/lib/constants";
import type { AdminScenario } from "@/types/admin";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface ScenarioManagerProps {
  initialScenarios: AdminScenario[];
}

const EMPTY_SLOTS = Array.from({ length: KEY_ATTRIBUTES_PER_ROUND }, () => "");

export function ScenarioManager({ initialScenarios }: ScenarioManagerProps) {
  const [scenarios, setScenarios] = useState<AdminScenario[]>(initialScenarios);
  const [editing, setEditing] = useState<AdminScenario | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [text, setText] = useState("");
  const [slots, setSlots] = useState<string[]>(EMPTY_SLOTS);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminScenario | null>(null);

  function startCreate() {
    setEditing(null);
    setIsCreating(true);
    setText("");
    setSlots([...EMPTY_SLOTS]);
    setFormError(null);
  }

  function startEdit(scenario: AdminScenario) {
    setEditing(scenario);
    setIsCreating(true);
    setText(scenario.text);
    setSlots([...scenario.suggested_attributes]);
    setFormError(null);
  }

  function cancelForm() {
    setIsCreating(false);
    setEditing(null);
  }

  function handleSlotChange(index: number, value: string) {
    setSlots((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!text.trim()) {
      setFormError("Senaryo metni gerekli.");
      return;
    }
    if (slots.some((s) => !s)) {
      setFormError("5 nitelik de seçilmeli.");
      return;
    }
    if (new Set(slots).size !== slots.length) {
      setFormError("Nitelikler birbirinden farklı olmalı.");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const { scenario } = await adminApi.updateScenario(editing.id, {
          text: text.trim(),
          suggestedAttributes: slots,
        });
        setScenarios((prev) => prev.map((s) => (s.id === scenario.id ? scenario : s)));
      } else {
        const { scenario } = await adminApi.createScenario({
          text: text.trim(),
          suggestedAttributes: slots,
        });
        setScenarios((prev) => [...prev, scenario]);
      }
      setIsCreating(false);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    const scenario = pendingDelete;
    setPendingDelete(null);
    try {
      await adminApi.deleteScenario(scenario.id);
      setScenarios((prev) => prev.filter((s) => s.id !== scenario.id));
    } catch {
      // leave list as-is; user can retry
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl tracking-wide">Senaryolar</h1>
        {!isCreating && (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-none border-2 border-secondary bg-accent px-4 py-2 font-display text-xs tracking-wide text-white shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            Yeni Senaryo
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-none border-2 border-line bg-dominant-soft p-4"
        >
          <div>
            <label htmlFor="scenario-text" className="mb-1 block text-sm text-secondary-soft">
              Senaryo metni
            </label>
            <textarea
              id="scenario-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full rounded-none border-2 border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {slots.map((value, index) => (
              <div key={index}>
                <label className="mb-1 block text-xs text-secondary-soft">Öneri {index + 1}</label>
                <select
                  value={value}
                  onChange={(e) => handleSlotChange(index, e.target.value)}
                  className="w-full rounded-none border-2 border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="">Seçin…</option>
                  {BATTLE_ATTRIBUTES.map((attr) => (
                    <option
                      key={attr.key}
                      value={attr.key}
                      disabled={slots.includes(attr.key) && value !== attr.key}
                    >
                      {attr.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-none border-2 border-secondary bg-accent px-4 py-2 font-display text-xs tracking-wide text-white shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
            >
              {submitting ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-none border-2 border-secondary bg-dominant-soft px-4 py-2 font-display text-xs tracking-wide text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="flex flex-col gap-2 rounded-none border-2 border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm text-secondary">{scenario.text}</p>
              <p className="mt-1 text-xs text-secondary-soft">
                {scenario.suggested_attributes
                  .map((key) => attributeLabel(key as BattleAttributeKey))
                  .join(", ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => startEdit(scenario)}
                className="rounded-none border-2 border-secondary bg-dominant-soft px-3 py-1.5 text-xs shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Düzenle
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(scenario)}
                className="rounded-none border-2 border-secondary bg-danger-soft px-3 py-1.5 text-xs text-danger shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Senaryoyu sil"
        message={`"${pendingDelete?.text}" kalıcı olarak silinecek.`}
        confirmLabel="Sil"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
