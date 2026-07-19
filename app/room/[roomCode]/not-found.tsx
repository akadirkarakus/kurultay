import Link from "next/link";

export default function RoomNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-xl tracking-wide">Oda bulunamadı</h1>
      <p className="text-secondary-soft">Bu oda koduyla eşleşen bir oyun yok.</p>
      <Link
        href="/"
        className="rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
      >
        Ana sayfaya dön
      </Link>
    </main>
  );
}
