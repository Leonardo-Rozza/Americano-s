import { Prisma, type PrismaClient } from "@prisma/client";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import { createGroups, getFixtureR1, getFixtureR2 } from "@/lib/tournament-engine/groups";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { applyTiebreakToRanking, buildTiebreakProgress } from "@/lib/tournament-engine/tiebreak";
import type { GrupoConfig, MatchResult, RankingEntry, Round1Result, TiebreakInfo } from "@/lib/tournament-engine/types";
import { ApiError } from "@/lib/api";
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
    groupConfig?: GrupoConfig;
  },
) {
  const torneo = await tx.torneo.create({
    data: {
      userId: input.userId,
      nombre: input.nombre,
      tipo: "AMERICANO",
      estado: "GRUPOS",
      metodoDesempate: input.metodoDesempate,
      fecha: new Date(),
    },
  });

  const createdPairs = [];
  if (input.pairMode === "GENERIC") {
    for (let idx = 0; idx < input.numParejas; idx += 1) {
      const pair = await tx.pareja.create({
        data: {
          torneoId: torneo.id,
          nombre: buildGenericPairName(idx + 1),
          jugador1: null,
          jugador2: null,
        },
      });
      createdPairs.push(pair);
    }
  } else {
    if (!input.pairPlayers || input.pairPlayers.length !== input.numParejas) {
      throw new ApiError("Debes enviar exactamente numParejas parejas en modo personalizado.", 400);
    }

    for (const pairPlayers of input.pairPlayers) {
      const pair = await tx.pareja.create({
        data: {
          torneoId: torneo.id,
          jugador1: pairPlayers.jugador1,
          jugador2: pairPlayers.jugador2,
          nombre: buildPairName(pairPlayers.jugador1, pairPlayers.jugador2),
        },
      });
      createdPairs.push(pair);
    }
  }

  const shuffledGroups = createGroups(
    createdPairs.map((pair) => ({ id: pair.id, nombre: pair.nombre })),
    input.groupConfig,
  );
  for (let idx = 0; idx < shuffledGroups.length; idx += 1) {
    const groupName = String.fromCharCode(65 + idx);
    const group = await tx.grupo.create({
      data: {
        torneoId: torneo.id,
        nombre: groupName,
      },
    });

    const groupPairs = shuffledGroups[idx];
    for (const pair of groupPairs) {
      await tx.pareja.update({
        where: { id: pair.id },
        data: { grupoId: group.id },
      });
    }

    const fixture = getFixtureR1(groupPairs.length);
    for (let fixtureIdx = 0; fixtureIdx < fixture.length; fixtureIdx += 1) {
      const [a, b] = fixture[fixtureIdx];
      await tx.partidoGrupo.create({
        data: {
          grupoId: group.id,
          fase: "RONDA1",
          orden: fixtureIdx + 1,
          pareja1Id: groupPairs[a].id,
          pareja2Id: groupPairs[b].id,
        },
      });
    }
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
