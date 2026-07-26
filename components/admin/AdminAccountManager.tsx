"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/lib/client/adminApi";
import { ApiClientError } from "@/lib/client/http";
import type { AdminAccount } from "@/types/admin";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface AdminAccountManagerProps {
  initialAdmins: AdminAccount[];
  currentAdminId: string;
}

export function AdminAccountManager({ initialAdmins, currentAdminId }: AdminAccountManagerProps) {
  const [admins, setAdmins] = useState<AdminAccount[]>(initialAdmins);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminAccount | null>(null);

  const superAdminCount = admins.filter((a) => a.is_super_admin).length;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (username.trim().length < 3) {
      setFormError("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    if (password.length < 8) {
      setFormError("Şifre en az 8 karakter olmalı.");
      return;
    }

    setSubmitting(true);
    try {
      const { admin: created } = await adminApi.createAdmin({
        username: username.trim(),
        password,
        isSuperAdmin,
      });
      setAdmins((prev) => [...prev, created]);
      setUsername("");
      setPassword("");
      setIsSuperAdmin(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Hesap oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await adminApi.deleteAdmin(target.id);
      setAdmins((prev) => prev.filter((a) => a.id !== target.id));
    } catch {
      // leave list as-is; the server-side guard already prevented anything unsafe
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl tracking-wide">Adminler</h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-3 rounded-none border-2 border-line bg-dominant-soft p-4"
      >
        <div>
          <label htmlFor="new-admin-username" className="mb-1 block text-sm text-secondary-soft">
            Kullanıcı adı
          </label>
          <input
            id="new-admin-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-none border-2 border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="new-admin-password" className="mb-1 block text-sm text-secondary-soft">
            Şifre
          </label>
          <input
            id="new-admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-none border-2 border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-secondary-soft">
          <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} />
          Süper admin
        </label>

        {formError && <p className="text-sm text-danger">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-none border-2 border-secondary bg-accent px-4 py-2 font-display text-xs tracking-wide text-white shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
        >
          {submitting ? "Oluşturuluyor…" : "Hesap oluştur"}
        </button>
      </form>

      <div className="space-y-2">
        {admins.map((account) => {
          const isSelf = account.id === currentAdminId;
          const isLastSuperAdmin = account.is_super_admin && superAdminCount <= 1;
          const disableDelete = isSelf || isLastSuperAdmin;
          return (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-none border-2 border-line bg-surface p-4"
            >
              <div>
                <p className="text-sm text-secondary">
                  {account.username}
                  {account.is_super_admin && (
                    <span className="ml-2 rounded-none border border-accent px-1.5 py-0.5 text-xs text-accent">
                      süper admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-secondary-soft">
                  {new Date(account.created_at).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <button
                type="button"
                disabled={disableDelete}
                title={
                  isSelf
                    ? "Kendi hesabınızı silemezsiniz."
                    : isLastSuperAdmin
                      ? "Son süper admin silinemez."
                      : undefined
                }
                onClick={() => setPendingDelete(account)}
                className="rounded-none border-2 border-secondary bg-danger-soft px-3 py-1.5 text-xs text-danger shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sil
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Admin hesabını sil"
        message={`"${pendingDelete?.username}" hesabı kalıcı olarak silinecek.`}
        confirmLabel="Sil"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
