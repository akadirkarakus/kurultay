"use client";

import { useState } from "react";
import type { CharacterSummary } from "@/types/game";

interface CharacterCardProps {
  character: CharacterSummary;
  selected?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

export function CharacterCard({
  character,
  selected,
  disabled,
  dimmed,
  onClick,
}: CharacterCardProps) {
  const [imgError, setImgError] = useState(false);
  const initials = character.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col overflow-hidden rounded-none border-2 text-left transition ${
        selected ? "border-accent shadow-[4px_4px_0_0_var(--color-accent)]" : "border-secondary"
      } ${dimmed ? "opacity-40" : ""} ${!disabled ? "hover:border-accent" : ""}`}
    >
      <div className="aspect-3/4 w-full bg-dominant-soft">
        {character.image_url && !imgError ? (
          // Character portraits are dynamic Supabase Storage URLs; a plain
          // <img> avoids configuring next/image remote patterns for an MVP.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.image_url}
            alt={character.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-lg text-secondary-muted">
            {initials}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-base">{character.name}</p>
      </div>
    </button>
  );
}
