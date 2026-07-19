"use client";

import type { PlayerSummary } from "@/types/game";

/** Shows a live "who's picked" checkmark row, without ever revealing what anyone picked. */
export function PickWaitingBanner({
  players,
  pickedPlayerIds,
}: {
  players: PlayerSummary[];
  pickedPlayerIds: string[];
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 text-sm">
      {players.map((p) => {
        const hasPicked = pickedPlayerIds.includes(p.id);
        return (
          <span
            key={p.id}
            className={`rounded-none border-2 px-3 py-1 ${hasPicked ? "border-success bg-success-soft text-success" : "border-line bg-dominant-soft text-secondary-soft"}`}
          >
            {p.nickname} {hasPicked ? "✓" : "…"}
          </span>
        );
      })}
    </div>
  );
}
