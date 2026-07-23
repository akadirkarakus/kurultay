"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { HowToPlayButton } from "@/components/shared/HowToPlayModal";

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError(null);
    if (!nickname.trim()) {
      setError("Lütfen bir takma ad girin.");
      return;
    }
    setLoading(true);
    try {
      const { roomCode } = await api.createGame(nickname.trim());
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Oda oluşturulamadı.");
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError(null);
    if (!nickname.trim() || joinCode.trim().length !== 6) {
      setError("Takma ad ve 6 haneli oda kodu gerekli.");
      return;
    }
    setLoading(true);
    try {
      const { roomCode } = await api.joinGame(joinCode.trim().toUpperCase(), nickname.trim());
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Odaya katılınamadı.");
      setLoading(false);
    }
  }

  async function handleSinglePlayer() {
    setError(null);
    if (!nickname.trim()) {
      setError("Lütfen bir takma ad girin.");
      return;
    }
    setLoading(true);
    try {
      const { roomCode } = await api.createSinglePlayerGame(nickname.trim());
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Tek kişilik oyun başlatılamadı.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <HowToPlayButton />
      <div className="text-center">
        <h1 className="font-display text-6xl tracking-wide">Kurultay</h1>
        <p className="mt-3 text-secondary-soft">Karakterlerini seç, dünyayı kurtar.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="nickname" className="mb-1 block text-sm text-secondary-soft">
            Takma ad
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="Adınız"
            className="w-full rounded-none border-2 border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
        </div>

        {mode === "join" && (
          <div>
            <label htmlFor="room-code" className="mb-1 block text-sm text-secondary-soft">
              Oda kodu
            </label>
            <input
              id="room-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABCDEF"
              className="w-full rounded-none border-2 border-line bg-surface px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-accent"
            />
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="space-y-3">
          {mode === "join" ? (
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
            >
              {loading ? "Katılıyor…" : "Odaya Katıl"}
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full rounded-none border-2 border-secondary bg-accent px-4 py-3 font-display text-xs tracking-wide text-white shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
            >
              {loading ? "Oluşturuluyor…" : "Oda Oluştur"}
            </button>
          )}

          <button
            onClick={() => {
              setError(null);
              setMode(mode === "join" ? null : "join");
            }}
            className="w-full rounded-none border-2 border-secondary px-4 py-3 font-display text-xs tracking-wide text-secondary shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform hover:bg-dominant-soft active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            {mode === "join" ? "Yeni oda oluştur" : "Oda koduyla katıl"}
          </button>

          <button
            onClick={handleSinglePlayer}
            disabled={loading}
            className="w-full rounded-none border-2 border-secondary px-4 py-3 font-display text-xs tracking-wide text-secondary shadow-[4px_4px_0_0_var(--color-secondary)] transition-transform hover:bg-dominant-soft active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
          >
            {loading ? "Başlatılıyor…" : "Tek Kişilik Mod"}
          </button>
        </div>
      </div>
    </main>
  );
}
