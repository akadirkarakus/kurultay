import { requireSuperAdmin } from "@/lib/server/adminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminAccountManager } from "@/components/admin/AdminAccountManager";

// The layout only guarantees "is an admin" — this page needs "is a super
// admin" specifically (only super admins can manage other admin accounts),
// so it calls requireSuperAdmin itself rather than trusting the layout.
export default async function AdminAccountsPage() {
  const admin = supabaseAdmin();

  let currentAdminId: string;
  try {
    const caller = await requireSuperAdmin(admin);
    currentAdminId = caller.id;
  } catch {
    return <p className="text-sm text-danger">Bu sayfayı görüntülemek için süper admin yetkisi gerekiyor.</p>;
  }

  const { data } = await admin
    .from("admin_users")
    .select("id, username, is_super_admin, created_at")
    .order("created_at");

  return <AdminAccountManager initialAdmins={data ?? []} currentAdminId={currentAdminId} />;
}
