import type { RankingEntry, TiebreakInfo } from "./types";

export type TiebreakRecord = {
  id: string;
  pareja1Id: string;
  pareja2Id: string;
  ganadorId: string | null;
  resuelto: boolean;
};

export type TiebreakProgress = {
  tiePairIds: string[];
  byeSlotsInDispute: number;
  eliminatedIds: string[];
  aliveIds: string[];
  complete: boolean;
  expectedDuelPairIds: [string, string] | null;
  currentDuel: { id: string; pareja1Id: string; pareja2Id: string } | null;
};

function samePair(a1: string, a2: string, b1: string, b2: string): boolean {
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

export function buildTiebreakProgress(
  tiebreakInfo: TiebreakInfo | null,
  records: TiebreakRecord[],
): TiebreakProgress | null {
  if (!tiebreakInfo || tiebreakInfo.parejas.length < 2) {
    return null;
  }

  const tiePairIds = tiebreakInfo.parejas.map((pair) => pair.id);
  const tieSet = new Set(tiePairIds);
  const byeSlotsInDispute = Math.max(
    1,
    Math.min(tiebreakInfo.byeSlotsInDispute, tiePairIds.length - 1),
  );
  const eliminationsNeeded = tiePairIds.length - byeSlotsInDispute;

  const orderedRecords = [...records].sort((a, b) => a.id.localeCompare(b.id));
  const eliminatedSet = new Set<string>();
  const eliminatedIds: string[] = [];

  for (const record of orderedRecords) {
    if (!record.resuelto || !record.ganadorId) {
      continue;
    }
    if (!tieSet.has(record.pareja1Id) || !tieSet.has(record.pareja2Id)) {
      continue;
    }
    if (record.ganadorId !== record.pareja1Id && record.ganadorId !== record.pareja2Id) {
      continue;
    }

    const loserId = record.ganadorId === record.pareja1Id ? record.pareja2Id : record.pareja1Id;
    if (eliminatedSet.has(loserId) || eliminatedSet.has(record.ganadorId)) {
      continue;
    }

    eliminatedSet.add(loserId);
    eliminatedIds.push(loserId);

    if (eliminatedIds.length >= eliminationsNeeded) {
      break;
    }
  }

  const aliveIds = tiePairIds.filter((pairId) => !eliminatedSet.has(pairId));
  const complete = aliveIds.length <= byeSlotsInDispute;
  const expectedDuelPairIds =
    !complete && aliveIds.length >= 2 ? ([aliveIds[0], aliveIds[1]] as [string, string]) : null;

  const unresolved = orderedRecords.find((record) => !record.resuelto);
  const currentDuel =
    unresolved &&
    expectedDuelPairIds &&
    samePair(
      unresolved.pareja1Id,
      unresolved.pareja2Id,
      expectedDuelPairIds[0],
      expectedDuelPairIds[1],
    )
      ? {
          id: unresolved.id,
          pareja1Id: unresolved.pareja1Id,
          pareja2Id: unresolved.pareja2Id,
        }
      : null;

  return {
    tiePairIds,
    byeSlotsInDispute,
    eliminatedIds,
    aliveIds,
    complete,
    expectedDuelPairIds,
    currentDuel,
  };
}

export function applyTiebreakToRanking(
  ranking: RankingEntry[],
  progress: TiebreakProgress | null,
): RankingEntry[] {
  if (!progress || !progress.complete) {
    return ranking;
  }

  const tieSet = new Set(progress.tiePairIds);
  const aliveSet = new Set(progress.aliveIds);
  const rowById = new Map(ranking.map((row) => [row.pareja.id, row]));
  const tieIndexes = progress.tiePairIds
    .map((pairId) => ranking.findIndex((row) => row.pareja.id === pairId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (tieIndexes.length !== progress.tiePairIds.length) {
    return ranking;
  }

  const orderedTieRows = [
    ...progress.tiePairIds.filter((pairId) => aliveSet.has(pairId)),
    ...progress.tiePairIds.filter((pairId) => tieSet.has(pairId) && !aliveSet.has(pairId)),
  ]
    .map((pairId) => rowById.get(pairId))
    .filter((row): row is RankingEntry => Boolean(row));

  if (orderedTieRows.length !== tieIndexes.length) {
    return ranking;
  }

  const reordered = [...ranking];
  for (let idx = 0; idx < tieIndexes.length; idx += 1) {
    reordered[tieIndexes[idx]] = orderedTieRows[idx];
  }
  return reordered;
}
