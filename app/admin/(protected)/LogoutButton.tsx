"use client";

import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/client/adminApi";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await adminApi.logout();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-none border-2 border-secondary px-3 py-1.5 text-xs shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      Çıkış
    </button>
  );
}
