"use client";

import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";

export function GameOverScreen() {
  const state = useGameStore((s) => s.state)!;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = sorted.filter((p) => p.score === topScore);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div>
        <p className="text-sm text-secondary-muted">Oyun Bitti</p>
        <h1 className="mt-3 font-display text-lg leading-relaxed tracking-wide">
          {winners.length > 1
            ? `${winners.map((w) => w.nickname).join(", ")} berabere kazandı!`
            : `${winners[0]?.nickname} kazandı!`}
        </h1>
      </div>

      <ul className="w-full max-w-sm space-y-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-none border-2 px-4 py-3 ${
              p.score === topScore
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface"
            }`}
          >
            <span>
              {i + 1}. {p.nickname}
            </span>
            <span className="font-mono">{p.score}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="w-full max-w-sm rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
      >
        Yeniden Oyna
      </Link>
    </main>
  );
}
