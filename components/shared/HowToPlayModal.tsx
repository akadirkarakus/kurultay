"use client";

import { useState } from "react";
import { DECK_SIZE, ROUND_COUNT } from "@/lib/constants";

export function HowToPlayButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-4 z-50 rounded-none border-2 border-secondary bg-surface px-3 py-2 text-xs text-secondary shadow-[3px_3px_0_0_var(--color-secondary)] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        Nasıl Oynanır?
      </button>

      {open && <HowToPlayDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function HowToPlayDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-secondary/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-none border-2 border-secondary bg-surface p-6 shadow-[6px_6px_0_0_var(--color-secondary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg tracking-wide text-secondary">Nasıl Oynanır?</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-none border-2 border-secondary bg-dominant-soft px-2 py-1 text-xs text-secondary shadow-[2px_2px_0_0_var(--color-secondary)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Kapat
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-secondary-soft">
          <p>
            <strong className="text-secondary">Amaç:</strong> Karakterlerinden oluşan destenle
            rakiplerine karşı en çok turu kazanmak.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Bir oda kur ya da bir odaya katıl (2-4 oyuncu), veya tek kişilik modda botlara karşı oyna.</li>
            <li>
              Her aşamada aynı kategorideki 5 karttan birini seç; bu şekilde {DECK_SIZE} karakterlik desteni oluşturursun.
            </li>
            <li>
              Her turda bir senaryo gösterilir ve senaryoyla en alakalı özellikler belirlenir. Elindeki
              kullanılmamış bir karakteri gizlice oynayarak tura katıl.
            </li>
            <li>
              Belirlenen özelliklerdeki ortalaması en yüksek olan oyuncu turu kazanır. Berabelik
              olursa, kalan son kartlarınızla ek bir belirleme turu oynanır.
            </li>
            <li>
              Her oyuncunun oyun boyunca bir kere kullanabileceği bir jokeri vardır; avantaj sağlamak
              için istediğin turda kullanabilirsin.
            </li>
            <li>{ROUND_COUNT} tur sonunda en çok turu kazanan oyuncu oyunu kazanır.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
