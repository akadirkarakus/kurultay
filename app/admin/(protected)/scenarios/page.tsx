import { supabaseAdmin } from "@/lib/supabase/admin";
import { ScenarioManager } from "@/components/admin/ScenarioManager";

export default async function AdminScenariosPage() {
  const admin = supabaseAdmin();
  const { data } = await admin.from("scenarios").select("*").order("text");

  return <ScenarioManager initialScenarios={data ?? []} />;
}
