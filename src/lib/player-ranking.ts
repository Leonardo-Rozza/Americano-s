import type { PadelCategory } from "@/lib/padel-category";
import { buildPlayerIdentityKey, normalizePlayerName } from "@/lib/player-identity";
import { isGenericPair, resolvePairPlayers } from "@/lib/pair-utils";

const PLAYER_RANKING_POINTS = {
  champion: 100,
  finalist: 70,
  semifinalist: 50,
  quarterfinalist: 35,
} as const;

type RankingTournament = {
  id: string;
  nombre: string;
  fecha: Date;
  categoriaPadel: PadelCategory | null;
  estado: string;
  parejas: Array<{
    id: string;
    nombre: string;
    jugador1: string | null;
    jugador2: string | null;
  }>;
  bracket: {
    totalRondas: number;
    matches: Array<{
      id: string;
      ronda: number;
      posicion: number;
      pareja1Id: string | null;
      pareja2Id: string | null;
      ganadorId: string | null;
      completado: boolean;
      esBye: boolean;
    }>;
  } | null;
};

type RankingBracketMatch = NonNullable<RankingTournament["bracket"]>["matches"][number];

type PlayerRankingAccumulator = {
  key: string;
  nombre: string;
  puntos: number;
  campeonatos: number;
  finales: number;
  semifinales: number;
  cuartos: number;
  torneos: Set<string>;
};

export type PlayerRankingRow = {
  key: string;
  nombre: string;
  puntos: number;
  campeonatos: number;
  finales: number;
  semifinales: number;
  cuartos: number;
  torneos: number;
};

export type PlayerRankingSummary = {
  rows: PlayerRankingRow[];
  includedTournaments: number;
  excludedTournaments: number;
  totalFinalizedTournaments: number;
};

function buildPairPlayersById(torneo: RankingTournament) {
  const pairPlayersById = new Map<string, string[]>();

  for (const pair of torneo.parejas) {
    if (isGenericPair(pair)) {
      return null;
    }

    const players = resolvePairPlayers(pair);
    if (!players?.jugador1 || !players.jugador2) {
      return null;
    }

    pairPlayersById.set(pair.id, [
      normalizePlayerName(players.jugador1),
      normalizePlayerName(players.jugador2),
    ]);
  }

  return pairPlayersById;
}

function resolveLoser(match: RankingBracketMatch) {
  if (!match.ganadorId || !match.pareja1Id || !match.pareja2Id) {
    return null;
  }

  return match.ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;
}

function addPlayersFromPair(
  rows: Map<string, PlayerRankingAccumulator>,
  tournamentId: string,
  pairPlayersById: Map<string, string[]>,
  pairId: string | null,
  points: number,
  stat: "campeonatos" | "finales" | "semifinales" | "cuartos",
) {
  if (!pairId) {
    return;
  }

  const players = pairPlayersById.get(pairId);
  if (!players) {
    return;
  }

  for (const playerName of players) {
    const key = buildPlayerIdentityKey(playerName);
    const current = rows.get(key) ?? {
      key,
      nombre: playerName,
      puntos: 0,
      campeonatos: 0,
      finales: 0,
      semifinales: 0,
      cuartos: 0,
      torneos: new Set<string>(),
    };

    current.puntos += points;
    current[stat] += 1;
    current.torneos.add(tournamentId);
    rows.set(key, current);
  }
}

function isTournamentEligible(torneo: RankingTournament) {
  if (torneo.estado !== "FINALIZADO" || !torneo.categoriaPadel || !torneo.bracket) {
    return false;
  }

  const bracket = torneo.bracket;
  const finalMatch = bracket.matches.find((match) => match.ronda === bracket.totalRondas);
  if (!finalMatch?.completado || !finalMatch.ganadorId) {
    return false;
  }

  return buildPairPlayersById(torneo) !== null;
}

export function computePlayerRankingByCategory(
  torneos: RankingTournament[],
  category: PadelCategory,
): PlayerRankingSummary {
  const eligibleRows = new Map<string, PlayerRankingAccumulator>();
  const categoryTournaments = torneos.filter(
    (torneo) => torneo.categoriaPadel === category && torneo.estado === "FINALIZADO",
  );

  let includedTournaments = 0;

  for (const torneo of categoryTournaments) {
    if (!isTournamentEligible(torneo)) {
      continue;
    }

    const pairPlayersById = buildPairPlayersById(torneo);
    if (!pairPlayersById || !torneo.bracket) {
      continue;
    }

    const finalRound = torneo.bracket.totalRondas;
    const finalMatch = torneo.bracket.matches.find((match) => match.ronda === finalRound);
    if (!finalMatch?.ganadorId) {
      continue;
    }

    includedTournaments += 1;

    addPlayersFromPair(
      eligibleRows,
      torneo.id,
      pairPlayersById,
      finalMatch.ganadorId,
      PLAYER_RANKING_POINTS.champion,
      "campeonatos",
    );
    addPlayersFromPair(
      eligibleRows,
      torneo.id,
      pairPlayersById,
      resolveLoser(finalMatch),
      PLAYER_RANKING_POINTS.finalist,
      "finales",
    );

    if (finalRound >= 2) {
      const semifinalRound = finalRound - 1;
      for (const match of torneo.bracket.matches.filter((item) => item.ronda === semifinalRound)) {
        addPlayersFromPair(
          eligibleRows,
          torneo.id,
          pairPlayersById,
          resolveLoser(match),
          PLAYER_RANKING_POINTS.semifinalist,
          "semifinales",
        );
      }
    }

    if (finalRound >= 3) {
      const quarterRound = finalRound - 2;
      for (const match of torneo.bracket.matches.filter((item) => item.ronda === quarterRound)) {
        addPlayersFromPair(
          eligibleRows,
          torneo.id,
          pairPlayersById,
          resolveLoser(match),
          PLAYER_RANKING_POINTS.quarterfinalist,
          "cuartos",
        );
      }
    }
  }

  const rows = [...eligibleRows.values()]
    .map((row) => ({
      key: row.key,
      nombre: row.nombre,
      puntos: row.puntos,
      campeonatos: row.campeonatos,
      finales: row.finales,
      semifinales: row.semifinales,
      cuartos: row.cuartos,
      torneos: row.torneos.size,
    }))
    .sort((left, right) => {
      if (right.puntos !== left.puntos) {
        return right.puntos - left.puntos;
      }
      if (right.campeonatos !== left.campeonatos) {
        return right.campeonatos - left.campeonatos;
      }
      if (right.finales !== left.finales) {
        return right.finales - left.finales;
      }
      if (right.semifinales !== left.semifinales) {
        return right.semifinales - left.semifinales;
      }
      return left.nombre.localeCompare(right.nombre, "es");
    });

  return {
    rows,
    includedTournaments,
    excludedTournaments: categoryTournaments.length - includedTournaments,
    totalFinalizedTournaments: categoryTournaments.length,
  };
}
