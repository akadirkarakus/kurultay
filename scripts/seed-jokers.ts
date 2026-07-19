import { pathToFileURL } from "node:url";
import { JOKERS } from "@/lib/jokers";
import { createAdminClient } from "@/lib/supabase/create-admin-client";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

async function main() {
  const admin = createAdminClient();
  const rows = JOKERS.map((j, index) => ({
    key: j.key,
    name: j.name,
    description: j.description,
    needs_own_character: j.needsOwnCharacter,
    needs_target_player: j.needsTargetPlayer,
    sort_order: index,
  }));
  const { error } = await admin.from("jokers").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(`Seeding jokers failed: ${error.message}`);
  console.log(`Seeded ${rows.length} jokers.`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
