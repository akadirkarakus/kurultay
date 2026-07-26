"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-secondary/40 px-4 py-8"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-none border-2 border-secondary bg-surface p-6 shadow-[6px_6px_0_0_var(--color-secondary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-base tracking-wide text-secondary">{title}</h2>
        <p className="mt-3 text-sm text-secondary-soft">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-none border-2 border-secondary bg-dominant-soft px-3 py-2 text-xs text-secondary shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-none border-2 border-secondary bg-danger px-3 py-2 text-xs text-white shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
