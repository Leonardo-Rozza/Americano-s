import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import {
  calcGroupsPrioritizing4,
  createGroups,
  getFixtureR1,
  getFixtureR2,
} from "@/lib/tournament-engine/groups";
import { getLargoFixture } from "@/lib/tournament-engine/largo";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { applyTiebreakToRanking, buildTiebreakProgress } from "@/lib/tournament-engine/tiebreak";
import { isTournamentCombinationEnabled } from "@/lib/tournament-catalog";
import type {
  GrupoConfig,
  MatchResult,
  RankingEntry,
  Round1Result,
  TiebreakInfo,
  TournamentFormat,
  TournamentSport,
} from "@/lib/tournament-engine/types";
import { ApiError } from "@/lib/api";
import type { PadelCategory } from "@/lib/padel-category";
import { buildGenericPairName, buildPairName, resolvePairDisplayName, type PairMode } from "@/lib/pair-utils";

export const torneoFullInclude = {
  parejas: { orderBy: { nombre: "asc" } },
  grupos: {
    orderBy: { nombre: "asc" },
    include: {
      parejas: { orderBy: { nombre: "asc" } },
      partidos: { orderBy: [{ fase: "asc" }, { orden: "asc" }] },
    },
  },
  bracket: {
    include: {
      matches: { orderBy: [{ ronda: "asc" }, { posicion: "asc" }] },
    },
  },
  desempates: { orderBy: { id: "asc" } },
} satisfies Prisma.TorneoInclude;

export async function getTorneoOrThrow(
  client: PrismaClient | Prisma.TransactionClient,
  torneoId: string,
  userId?: string,
) {
  const torneo = userId
    ? await client.torneo.findFirst({
        where: { id: torneoId, userId },
        include: torneoFullInclude,
      })
    : await client.torneo.findUnique({
        where: { id: torneoId },
        include: torneoFullInclude,
      });

  if (!torneo) {
    throw new ApiError("Torneo no encontrado.", 404);
  }
  return torneo;
}

export function makeGroupRivals(groups: Array<{ parejas: Array<{ id: string }> }>) {
  const rivals: Record<string, string[]> = {};
  for (const group of groups) {
    const ids = group.parejas.map((pair) => pair.id);
    for (const id of ids) {
      rivals[id] = ids.filter((otherId) => otherId !== id);
    }
  }
  return rivals;
}

export function collectGroupResults(
  groups: Array<{
    partidos: Array<{
      pareja1Id: string;
      pareja2Id: string;
      gamesPareja1: number | null;
      gamesPareja2: number | null;
      completado: boolean;
    }>;
  }>,
): MatchResult[] {
  return groups.flatMap((group) =>
    group.partidos
      .filter((match) => match.gamesPareja1 !== null && match.gamesPareja2 !== null)
      .map((match) => ({
        pareja1Id: match.pareja1Id,
        pareja2Id: match.pareja2Id,
        gamesPareja1: match.gamesPareja1 ?? 0,
        gamesPareja2: match.gamesPareja2 ?? 0,
        completado: match.completado,
      })),
  );
}

export function areAllGroupMatchesComplete(
  groups: Array<{
    partidos: Array<{
      completado: boolean;
    }>;
  }>,
): boolean {
  if (groups.length === 0) {
    return false;
  }

  return groups.every((group) => group.partidos.length > 0 && group.partidos.every((match) => match.completado));
}

export async function generateRound2IfNeeded(tx: Prisma.TransactionClient, grupoId: string) {
  const group = await tx.grupo.findUnique({
    where: { id: grupoId },
    include: {
      parejas: { orderBy: { id: "asc" } },
      partidos: { orderBy: [{ fase: "asc" }, { orden: "asc" }] },
    },
  });
  if (!group) {
    throw new ApiError("Grupo no encontrado.", 404);
  }

  if (group.parejas.length !== 4) {
    return;
  }

  const r2Matches = group.partidos.filter((match) => match.fase === "RONDA2");
  if (r2Matches.length > 0) {
    return;
  }

  const r1Matches = group.partidos.filter((match) => match.fase === "RONDA1");
  if (r1Matches.length !== 2 || r1Matches.some((match) => !match.completado)) {
    return;
  }

  const indexByPairId = new Map(group.parejas.map((pair, idx) => [pair.id, idx]));
  const r1Results: Round1Result[] = r1Matches.map((match) => {
    if (match.gamesPareja1 === null || match.gamesPareja2 === null) {
      throw new ApiError("Faltan scores en ronda 1.", 400);
    }
    if (match.gamesPareja1 === match.gamesPareja2) {
      throw new ApiError("No se permiten empates en partidos de grupo.", 400);
    }

    const winnerId = match.gamesPareja1 > match.gamesPareja2 ? match.pareja1Id : match.pareja2Id;
    const loserId = winnerId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;
    const winner = indexByPairId.get(winnerId);
    const loser = indexByPairId.get(loserId);
    if (winner === undefined || loser === undefined) {
      throw new ApiError("No se pudo mapear resultado de ronda 1.", 400);
    }
    return { winner, loser };
  });

  const r2Fixture = getFixtureR2(4, r1Results);
  for (let idx = 0; idx < r2Fixture.length; idx += 1) {
    const [a, b] = r2Fixture[idx];
    await tx.partidoGrupo.create({
      data: {
        grupoId: group.id,
        fase: "RONDA2",
        orden: idx + 1,
        pareja1Id: group.parejas[a].id,
        pareja2Id: group.parejas[b].id,
      },
    });
  }
}

export async function computeTorneoRanking(
  tx: Prisma.TransactionClient,
  torneoId: string,
  userId?: string,
) {
  const torneo = await tx.torneo.findUnique({
    where: { id: torneoId },
    include: {
      parejas: { orderBy: { id: "asc" } },
      grupos: {
        include: {
          partidos: true,
        },
      },
    },
  });
  if (!torneo) {
    throw new ApiError("Torneo no encontrado.", 404);
  }
  if (userId && torneo.userId !== userId) {
    throw new ApiError("Torneo no encontrado.", 404);
  }

  const pairs = torneo.parejas.map((pair) => ({
    id: pair.id,
    nombre: resolvePairDisplayName(pair),
  }));
  const results = collectGroupResults(torneo.grupos);
  const ranking = computeRanking(pairs, results);
  const byes = getBracketSize(pairs.length) - pairs.length;
  const tiebreaks = detectTiebreaks(ranking, byes);

  return { torneo, ranking, tiebreaks, byes };
}

export async function createTorneoWithGroups(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    nombre: string;
    numParejas: number;
    metodoDesempate: "MONEDA" | "TIEBREAK";
    pairMode: PairMode;
    pairPlayers?: Array<{ jugador1: string; jugador2: string }>;
    categoriaPadel?: PadelCategory;
    config?: Record<string, unknown>;
    groupConfig?: GrupoConfig;
    deporte?: TournamentSport;
    formato?: TournamentFormat;
  },
) {
  const deporte = input.deporte ?? "PADEL";
  const formato = input.formato ?? "AMERICANO";
  if (!isTournamentCombinationEnabled(deporte, formato)) {
    throw new ApiError("La combinacion seleccionada aun no esta habilitada en esta version.", 409);
  }

  const mergedConfig: Record<string, unknown> = {
    ...(input.config ?? {}),
  };
  if (deporte === "PADEL" && formato === "LARGO") {
    const rawQualifiers = mergedConfig.qualifiersByGroupSize;
    const qualifiersRecord =
      rawQualifiers && typeof rawQualifiers === "object"
        ? (rawQualifiers as Record<string, unknown>)
        : {};
    mergedConfig.qualifiersByGroupSize = {
      "3": 2,
      "4": 3,
      ...qualifiersRecord,
    };
  }

  const torneo = await tx.torneo.create({
    data: {
      userId: input.userId,
      nombre: input.nombre,
      deporte,
      formato,
      categoriaPadel: deporte === "PADEL" ? (input.categoriaPadel ?? undefined) : undefined,
      config: Object.keys(mergedConfig).length > 0 ? (mergedConfig as Prisma.InputJsonValue) : undefined,
      tipo: formato === "LARGO" ? "LARGO" : "AMERICANO",
      estado: "GRUPOS",
      metodoDesempate: input.metodoDesempate,
      fecha: new Date(),
    },
  });

  const createdPairs: Array<{ id: string; nombre: string }> = [];
  if (input.pairMode === "GENERIC") {
    const pairsToCreate: Array<{
      id: string;
      torneoId: string;
      nombre: string;
      jugador1: string | null;
      jugador2: string | null;
    }> = [];

    for (let idx = 0; idx < input.numParejas; idx += 1) {
      const pairId = randomUUID();
      const pairName = buildGenericPairName(idx + 1);

      pairsToCreate.push({
        id: pairId,
        torneoId: torneo.id,
        nombre: pairName,
        jugador1: null,
        jugador2: null,
      });

      createdPairs.push({ id: pairId, nombre: pairName });
    }

    await tx.pareja.createMany({ data: pairsToCreate });
  } else {
    if (!input.pairPlayers || input.pairPlayers.length !== input.numParejas) {
      throw new ApiError("Debes enviar exactamente numParejas parejas en modo personalizado.", 400);
    }

    const pairsToCreate: Array<{
      id: string;
      torneoId: string;
      nombre: string;
      jugador1: string;
      jugador2: string;
    }> = [];

    for (const pairPlayers of input.pairPlayers) {
      const pairId = randomUUID();
      const pairName = buildPairName(pairPlayers.jugador1, pairPlayers.jugador2);

      pairsToCreate.push({
        id: pairId,
        torneoId: torneo.id,
        jugador1: pairPlayers.jugador1,
        jugador2: pairPlayers.jugador2,
        nombre: pairName,
      });

      createdPairs.push({ id: pairId, nombre: pairName });
    }

    await tx.pareja.createMany({ data: pairsToCreate });
  }

  const defaultConfig = formato === "LARGO" ? calcGroupsPrioritizing4(createdPairs.length) : undefined;
  const groupedPairs = createGroups(createdPairs, input.groupConfig ?? defaultConfig);
  const dbGroupIdByName = new Map<string, string>();

  for (let groupIdx = 0; groupIdx < groupedPairs.length; groupIdx += 1) {
    const groupPairs = groupedPairs[groupIdx];
    const groupName = String.fromCharCode(65 + groupIdx);
    const group = await tx.grupo.create({
      data: {
        torneoId: torneo.id,
        nombre: groupName,
      },
    });
    dbGroupIdByName.set(groupName, group.id);
    const pairIds = groupPairs.map((pair) => pair.id);
    await tx.pareja.updateMany({
      where: { id: { in: pairIds } },
      data: { grupoId: group.id },
    });
  }

  const groupMatchesToCreate: Array<{
    grupoId: string;
    fase: "RONDA1" | "RONDA2";
    orden: number;
    pareja1Id: string;
    pareja2Id: string;
  }> = [];

  for (let groupIdx = 0; groupIdx < groupedPairs.length; groupIdx += 1) {
    const groupPairs = groupedPairs[groupIdx];
    const groupName = String.fromCharCode(65 + groupIdx);
    const groupId = dbGroupIdByName.get(groupName);
    if (!groupId) {
      throw new ApiError("No se pudo mapear el grupo generado para el fixture.", 500);
    }

    const fixture = formato === "LARGO" ? getLargoFixture(groupPairs.length) : getFixtureR1(groupPairs.length);
    for (let matchIdx = 0; matchIdx < fixture.length; matchIdx += 1) {
      const [localSeed, visitanteSeed] = fixture[matchIdx];
      const localPair = groupPairs[localSeed];
      const visitantePair = groupPairs[visitanteSeed];

      groupMatchesToCreate.push({
        grupoId: groupId,
        fase: "RONDA1",
        orden: matchIdx + 1,
        pareja1Id: localPair.id,
        pareja2Id: visitantePair.id,
      });
    }
  }

  if (groupMatchesToCreate.length > 0) {
    await tx.partidoGrupo.createMany({
      data: groupMatchesToCreate,
    });
  }

  return torneo.id;
}

export function resolveRankingWithTiebreak(
  ranking: RankingEntry[],
  tiebreakInfo: TiebreakInfo | null,
  records: Array<{
    id: string;
    pareja1Id: string;
    pareja2Id: string;
    ganadorId: string | null;
    resuelto: boolean;
  }>,
) {
  const tiebreakProgress = buildTiebreakProgress(tiebreakInfo, records);
  const resolvedRanking = applyTiebreakToRanking(ranking, tiebreakProgress);

  return {
    ranking: resolvedRanking,
    tiebreakProgress,
    tiebreakPending: Boolean(tiebreakProgress && !tiebreakProgress.complete),
  };
}
