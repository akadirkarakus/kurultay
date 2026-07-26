import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CharacterTable } from "@/components/admin/CharacterTable";
import type { AdminCharacter } from "@/types/admin";

export default async function AdminCharactersPage() {
  const admin = supabaseAdmin();
  const { data } = await admin.from("characters").select("*").eq("is_active", true).order("name");
  const characters = (data ?? []) as unknown as AdminCharacter[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl tracking-wide">Karakterler</h1>
        <Link
          href="/admin/characters/new"
          className="rounded-none border-2 border-secondary bg-accent px-4 py-2 font-display text-xs tracking-wide text-white shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          Yeni Karakter
        </Link>
      </div>
      <CharacterTable initialCharacters={characters} />
    </div>
  );
}
