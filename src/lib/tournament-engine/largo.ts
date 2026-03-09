import { buildBracket, type GroupRivals } from "./bracket";
import { createGroups } from "./groups";
import {
  getPadelLargoMatchStats,
  parsePadelLargoScore,
  type PadelLargoScore,
} from "./scoring/padel-largo";
import type { GrupoConfig, Pareja } from "./types";

export type LargoMatchInput = {
  pareja1Id: string;
  pareja2Id: string;
  completado: boolean;
  scoreJson: unknown;
};

export type LargoRankingRow = {
  pareja: Pareja;
  pj: number;
  pg: number;
  pp: number;
  puntos: number;
  setsFavor: number;
  setsContra: number;
  setsDiff: number;
  gamesFavor: number;
  gamesContra: number;
  gamesDiff: number;
};

export type LargoGroupRanking = {
  groupId: string;
  groupName: string;
  rows: LargoRankingRow[];
};

export type LargoClassified = {
  groupId: string;
  groupName: string;
  position: number;
  pareja: Pareja;
};

export type LargoQualifiersByGroupSize = Partial<Record<"3" | "4", number>>;

type MutableLargoRow = Omit<LargoRankingRow, "setsDiff" | "gamesDiff">;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function winnerFromHeadToHead(
  headToHead: Map<string, string | null>,
  aId: string,
  bId: string,
): string | null {
  return headToHead.get(pairKey(aId, bId)) ?? null;
}

function toReadonlyRows(rows: MutableLargoRow[]): LargoRankingRow[] {
  return rows.map((row) => ({
    ...row,
    setsDiff: row.setsFavor - row.setsContra,
    gamesDiff: row.gamesFavor - row.gamesContra,
  }));
}

function isWalkoverScore(score: PadelLargoScore): boolean {
  return score.walkover === true;
}

function normalizeQualifiers(value: unknown, maxByGroupSize: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(maxByGroupSize, Math.max(1, value));
}

export function resolveLargoQualifiersByGroupSize(config: unknown): Record<"3" | "4", number> {
  const source =
    config && typeof config === "object"
      ? (config as Record<string, unknown>).qualifiersByGroupSize
      : null;
  const sourceRecord =
    source && typeof source === "object" ? (source as Record<string, unknown>) : null;

  return {
    "3": normalizeQualifiers(sourceRecord?.["3"], 3, 2),
    "4": normalizeQualifiers(sourceRecord?.["4"], 4, 3),
  };
}

export function createLargoGroups(parejas: Pareja[], selectedConfig?: GrupoConfig): Pareja[][] {
  return createGroups(parejas, selectedConfig);
}

export function getLargoFixture(groupSize: number): [number, number][] {
  if (groupSize === 3) {
    return [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
  }

  if (groupSize === 4) {
    return [
      [0, 1],
      [2, 3],
      [0, 2],
      [1, 3],
      [0, 3],
      [1, 2],
    ];
  }

  throw new Error("Solo se soportan grupos de 3 o 4 para formato largo.");
}

export function computeLargoRanking(
  parejas: Pareja[],
  matches: LargoMatchInput[],
): LargoRankingRow[] {
  const rows = new Map<string, MutableLargoRow>();
  for (const pareja of parejas) {
    rows.set(pareja.id, {
      pareja,
      pj: 0,
      pg: 0,
      pp: 0,
      puntos: 0,
      setsFavor: 0,
      setsContra: 0,
      gamesFavor: 0,
      gamesContra: 0,
    });
  }

  const headToHead = new Map<string, string | null>();

  for (const match of matches) {
    if (!match.completado) {
      continue;
    }

    const p1 = rows.get(match.pareja1Id);
    const p2 = rows.get(match.pareja2Id);
    if (!p1 || !p2) {
      continue;
    }

    const score = parsePadelLargoScore(match.scoreJson);
    if (!score) {
      continue;
    }

    const stats = getPadelLargoMatchStats(score);
    if (!stats.winner) {
      continue;
    }

    p1.pj += 1;
    p2.pj += 1;

    p1.setsFavor += stats.setsP1;
    p1.setsContra += stats.setsP2;
    p2.setsFavor += stats.setsP2;
    p2.setsContra += stats.setsP1;

    p1.gamesFavor += stats.gamesP1;
    p1.gamesContra += stats.gamesP2;
    p2.gamesFavor += stats.gamesP2;
    p2.gamesContra += stats.gamesP1;

    const walkover = isWalkoverScore(score);
    if (stats.winner === "p1") {
      p1.pg += 1;
      p2.pp += 1;
      p1.puntos += 3;
      p2.puntos += walkover ? 0 : 1;
      headToHead.set(pairKey(p1.pareja.id, p2.pareja.id), p1.pareja.id);
    } else {
      p2.pg += 1;
      p1.pp += 1;
      p2.puntos += 3;
      p1.puntos += walkover ? 0 : 1;
      headToHead.set(pairKey(p1.pareja.id, p2.pareja.id), p2.pareja.id);
    }
  }

  const ranked = toReadonlyRows([...rows.values()]);
  ranked.sort((a, b) => {
    if (b.puntos !== a.puntos) {
      return b.puntos - a.puntos;
    }

    const h2hWinner = winnerFromHeadToHead(headToHead, a.pareja.id, b.pareja.id);
    if (h2hWinner === a.pareja.id) {
      return -1;
    }
    if (h2hWinner === b.pareja.id) {
      return 1;
    }

    if (b.setsDiff !== a.setsDiff) {
      return b.setsDiff - a.setsDiff;
    }
    if (b.gamesDiff !== a.gamesDiff) {
      return b.gamesDiff - a.gamesDiff;
    }
    if (b.gamesFavor !== a.gamesFavor) {
      return b.gamesFavor - a.gamesFavor;
    }

    return a.pareja.nombre.localeCompare(b.pareja.nombre);
  });

  return ranked;
}

export function computeLargoRankingByGroup(
  groups: Array<{
    id: string;
    nombre: string;
    parejas: Pareja[];
    partidos: LargoMatchInput[];
  }>,
): LargoGroupRanking[] {
  return groups
    .map((group) => ({
      groupId: group.id,
      groupName: group.nombre,
      rows: computeLargoRanking(group.parejas, group.partidos),
    }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export function getLargoClassified(
  groupRankings: LargoGroupRanking[],
  qualifiersByGroupSize: LargoQualifiersByGroupSize = {},
): LargoClassified[] {
  const normalized = {
    "3": normalizeQualifiers(qualifiersByGroupSize["3"], 3, 2),
    "4": normalizeQualifiers(qualifiersByGroupSize["4"], 4, 3),
  };

  return groupRankings.flatMap((group) => {
    const key = group.rows.length === 4 ? "4" : "3";
    const qualifiers = normalized[key];

    return group.rows.slice(0, qualifiers).map((row, index) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      position: index + 1,
      pareja: row.pareja,
    }));
  });
}

export function buildLargoBracket(
  classified: LargoClassified[],
  groupRivals: GroupRivals,
) {
  const ordered = [...classified]
    .sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a.groupName.localeCompare(b.groupName);
    })
    .map((item) => item.pareja);

  return buildBracket(ordered, groupRivals);
}
