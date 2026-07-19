"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { api } from "@/lib/client/api";
import { useGameStore } from "@/store/useGameStore";
import { LobbyScreen } from "@/components/lobby/LobbyScreen";
import { CategoryDraftScreen } from "@/components/deck-draft/CategoryDraftScreen";
import { RoundScreen } from "@/components/round/RoundScreen";
import { RoundResultScreen } from "@/components/round-result/RoundResultScreen";
import { GameOverScreen } from "@/components/game-over/GameOverScreen";

interface PresencePayload {
  playerId: string;
}

export function GameClient({ gameId }: { gameId: string; roomCode: string }) {
  const state = useGameStore((s) => s.state);
  const error = useGameStore((s) => s.error);
  const setState = useGameStore((s) => s.setState);
  const setOnlinePlayerIds = useGameStore((s) => s.setOnlinePlayerIds);
  const setError = useGameStore((s) => s.setError);

  useEffect(() => {
    let disposed = false;
    const supabase = supabaseBrowser();
    const channel = supabase.channel(`game:${gameId}`);

    async function refresh() {
      try {
        const s = await api.getState(gameId);
        if (!disposed) setState(s);
        return s;
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : "Bağlantı hatası.");
        return null;
      }
    }

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => refresh(),
      )
      .on("broadcast", { event: "player_updated" }, () => refresh())
      .on("broadcast", { event: "pick_submitted" }, () => refresh())
      .on("broadcast", { event: "draft_pick_submitted" }, () => refresh())
      .on("broadcast", { event: "round_resolved" }, () => refresh())
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<PresencePayload>();
        const ids = new Set(Object.values(presenceState).flat().map((p) => p.playerId));
        setOnlinePlayerIds(ids);
      });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const s = await refresh();
      if (s) await channel.track({ playerId: s.me.id });
    });

    return () => {
      disposed = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (!state) {
    return (
      <main className="flex flex-1 items-center justify-center text-secondary-soft">
        {error ?? "Yükleniyor…"}
      </main>
    );
  }

  return (
    <>
      {error && (
        <div className="bg-danger-soft px-4 py-2 text-center text-sm text-danger">{error}</div>
      )}
      <GameScreen gameId={gameId} />
    </>
  );
}

function GameScreen({ gameId }: { gameId: string }) {
  const status = useGameStore((s) => s.state?.game.status);
  const roundNumber = useGameStore((s) => s.state?.game.currentRound);
  const draftStep = useGameStore((s) => s.state?.draft?.stepNumber);

  switch (status) {
    case "lobby":
      return <LobbyScreen gameId={gameId} />;
    case "deck_selection":
      // Keyed by draft step so each category gets a fresh countdown/mount.
      return <CategoryDraftScreen key={draftStep} gameId={gameId} />;
    case "in_round":
      // Keyed by round number so each round gets a fresh countdown/mount.
      return <RoundScreen key={roundNumber} gameId={gameId} />;
    case "round_result":
      return <RoundResultScreen key={roundNumber} gameId={gameId} />;
    case "finished":
      return <GameOverScreen />;
    default:
      return null;
  }
}
