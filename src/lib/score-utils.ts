export type DraftScores = Record<string, { s1: string; s2: string }>;

export type ServerScoreMatch = {
  id: string;
  gamesPareja1: number | null;
  gamesPareja2: number | null;
};

export function isValidMatchScore(games1: number, games2: number): boolean {
  if (!Number.isInteger(games1) || !Number.isInteger(games2)) {
    return false;
  }
  if (games1 < 0 || games2 < 0 || games1 > 6 || games2 > 6) {
    return false;
  }
  return (games1 === 6 && games2 <= 5) || (games2 === 6 && games1 <= 5);
}

export function mergeScoresKeepingDrafts(
  prev: DraftScores,
  matches: ServerScoreMatch[],
): DraftScores {
  const next: DraftScores = {};
  for (const match of matches) {
    if (match.gamesPareja1 !== null && match.gamesPareja2 !== null) {
      next[match.id] = {
        s1: String(match.gamesPareja1),
        s2: String(match.gamesPareja2),
      };
      continue;
    }
    next[match.id] = prev[match.id] ?? { s1: "", s2: "" };
  }
  return next;
}
