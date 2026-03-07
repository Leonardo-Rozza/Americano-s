import type { MatchResult, Pareja, RankingEntry, TiebreakInfo } from "./types";

function sameDiff(a: RankingEntry, b: RankingEntry): boolean {
  return a.diff === b.diff;
}

export function computeRanking(parejas: Pareja[], allResults: MatchResult[]): RankingEntry[] {
  const table = new Map<string, RankingEntry>();
  for (const pareja of parejas) {
    table.set(pareja.id, { pareja, gf: 0, gc: 0, diff: 0 });
  }

  for (const result of allResults) {
    if (result.completado === false) {
      continue;
    }
    const p1 = table.get(result.pareja1Id);
    const p2 = table.get(result.pareja2Id);
    if (!p1 || !p2) {
      continue;
    }

    p1.gf += result.gamesPareja1;
    p1.gc += result.gamesPareja2;
    p1.diff = p1.gf - p1.gc;

    p2.gf += result.gamesPareja2;
    p2.gc += result.gamesPareja1;
    p2.diff = p2.gf - p2.gc;
  }

  return [...table.values()].sort((a, b) => b.diff - a.diff || b.gf - a.gf);
}

export function detectTiebreaks(ranking: RankingEntry[], numByes: number): TiebreakInfo | null {
  if (numByes <= 0 || numByes >= ranking.length) {
    return null;
  }

  const cut = numByes - 1;
  let start = cut;
  let end = cut;

  while (start > 0 && sameDiff(ranking[start - 1], ranking[cut])) {
    start -= 1;
  }
  while (end < ranking.length - 1 && sameDiff(ranking[end + 1], ranking[cut])) {
    end += 1;
  }

  if (start === end) {
    return null;
  }

  const byeSlotsInDispute = Math.min(numByes, end + 1) - start;
  return {
    parejas: ranking.slice(start, end + 1).map((row) => row.pareja),
    byeSlotsInDispute,
  };
}
