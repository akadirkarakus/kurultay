"use client";

/** Depleting time-remaining bar, replacing a numeric countdown. Turns danger-colored in the final 10s, matching the old text-color warning threshold. */
export function CountdownBar({
  remainingMs,
  durationS,
}: {
  remainingMs: number | null;
  durationS: number;
}) {
  if (remainingMs === null) return null;

  const pct = Math.max(0, Math.min(100, (remainingMs / (durationS * 1000)) * 100));
  const low = remainingMs <= 10_000;

  return (
    <div className="mx-auto mt-3 h-4 w-full max-w-xs border-2 border-secondary bg-dominant-soft">
      <div
        className={`h-full ${low ? "bg-danger" : "bg-accent"}`}
        style={{ width: `${pct}%`, transition: "width 250ms linear" }}
      />
    </div>
  );
}
