export interface ScoredPlayer {
  playerId: string;
  score: number;
}

/** Returns the id(s) of the player(s) sharing the highest score. */
export function topScorers(players: readonly ScoredPlayer[]): string[] {
  if (players.length === 0) return [];
  const maxScore = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === maxScore).map((p) => p.playerId);
}

/** True when more than one player shares the top score (an overall tie). */
export function isOverallTie(players: readonly ScoredPlayer[]): boolean {
  return topScorers(players).length > 1;
}
