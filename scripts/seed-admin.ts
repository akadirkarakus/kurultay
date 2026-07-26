import { pathToFileURL } from "node:url";
import { hashPassword } from "@/lib/passwordHash";
import { createAdminClient } from "@/lib/supabase/create-admin-client";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

/**
 * Bootstraps the first admin account (always a super admin — there's no
 * other way to reach /admin/admins without one already existing). Every
 * admin account created after this goes through the panel itself.
 * Safe to re-run: if the username already exists, it exits without
 * modifying anything (it never overwrites an existing password).
 */
async function main() {
  const [, , argUsername, argPassword] = process.argv;
  const username = argUsername ?? process.env.ADMIN_SEED_USERNAME;
  const password = argPassword ?? process.env.ADMIN_SEED_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Usage: npm run seed:admin -- <username> <password> (or set ADMIN_SEED_USERNAME/ADMIN_SEED_PASSWORD)",
    );
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("admin_users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    console.log(`Admin "${username}" already exists — leaving it untouched.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const { error } = await admin
    .from("admin_users")
    .insert({ username, password_hash: passwordHash, is_super_admin: true });

  if (error) throw new Error(`Failed to create admin "${username}": ${error.message}`);
  console.log(`Created super admin "${username}".`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
