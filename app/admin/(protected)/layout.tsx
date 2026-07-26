import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/adminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LogoutButton } from "./LogoutButton";

// Guarantees "is *an* admin" only — pages that need super-admin access
// (e.g. app/admin/(protected)/admins/page.tsx) call requireSuperAdmin
// themselves, since Next partial rendering means this layout doesn't re-run
// on every client-side navigation between sibling pages.
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = supabaseAdmin();
  let adminUser;
  try {
    adminUser = await requireAdmin(admin);
  } catch {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-line px-6 py-4">
        <nav className="flex items-center gap-4 font-display text-xs tracking-wide">
          <Link href="/admin/characters" className="hover:text-accent">
            Karakterler
          </Link>
          <Link href="/admin/scenarios" className="hover:text-accent">
            Senaryolar
          </Link>
          {adminUser.is_super_admin && (
            <Link href="/admin/admins" className="hover:text-accent">
              Adminler
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm text-secondary-soft">
          <span>{adminUser.username}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
