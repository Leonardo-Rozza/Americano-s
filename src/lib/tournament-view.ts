import { getBracketSize } from "@/lib/tournament-engine/bracket";
import {
  computeLargoRankingByGroup,
  getLargoClassified,
  resolveLargoQualifiersByGroupSize,
} from "@/lib/tournament-engine/largo";
import { getPadelCategoryLabel, type PadelCategory } from "@/lib/padel-category";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { resolvePairDisplayName } from "@/lib/pair-utils";
import { collectGroupResults, resolveRankingWithTiebreak } from "@/lib/tournament-service";
import type { TournamentEstado } from "@/lib/tournament-routing";

type PairLike = {
  id: string;
  nombre?: string | null;
  jugador1?: string | null;
  jugador2?: string | null;
};

type GroupMatchResultLike = {
  pareja1Id: string;
  pareja2Id: string;
  gamesPareja1: number | null;
  gamesPareja2: number | null;
  completado: boolean;
};

type LargoMatchLike = {
  pareja1Id: string;
  pareja2Id: string;
  completado: boolean;
  scoreJson: unknown;
};

type GroupLike<TPair extends PairLike, TMatch> = {
  id: string;
  nombre: string;
  parejas: TPair[];
  partidos: TMatch[];
};

type TiebreakRecord = {
  id: string;
  pareja1Id: string;
  pareja2Id: string;
  ganadorId: string | null;
  resuelto: boolean;
};

type TournamentHeaderSource = {
  id: string;
  nombre: string;
  fecha: Date;
  estado: TournamentEstado | string;
  categoriaPadel?: PadelCategory | null;
  _count: {
    parejas: number;
  };
};

export function toDisplayPair<TPair extends PairLike>(pair: TPair) {
  return {
    ...pair,
    nombre: resolvePairDisplayName(pair),
  };
}

export function toDisplayPairs<TPair extends PairLike>(pairs: TPair[]) {
  return pairs.map((pair) => toDisplayPair(pair));
}

export function buildGroupStageView<
  TPair extends PairLike,
  TMatch,
  TTorneo extends {
    id: string;
    nombre: string;
    formato?: string;
    config?: Record<string, unknown> | null;
    grupos: Array<GroupLike<TPair, TMatch>>;
  },
>(torneo: TTorneo) {
  return {
    ...torneo,
    grupos: torneo.grupos.map((group) => ({
      ...group,
      parejas: toDisplayPairs(group.parejas),
    })),
  };
}

export function buildAmericanoRankingSnapshot<
  TPair extends PairLike,
  TGroup extends { partidos: GroupMatchResultLike[] },
>(input: {
  parejas: TPair[];
  grupos: TGroup[];
  desempates?: TiebreakRecord[];
}) {
  const pairs = toDisplayPairs(input.parejas).map((pair) => ({
    id: pair.id,
    nombre: pair.nombre,
  }));
  const ranking = computeRanking(pairs, collectGroupResults(input.grupos));
  const bracketSize = getBracketSize(ranking.length);
  const byes = bracketSize - ranking.length;
  const tiebreaks = detectTiebreaks(ranking, byes);
  const tiebreakResolution = input.desempates
    ? resolveRankingWithTiebreak(ranking, tiebreaks, input.desempates)
    : null;

  return {
    pairs,
    ranking,
    bracketSize,
    byes,
    tiebreaks,
    tiebreakResolution,
  };
}

export function buildLargoRankingSnapshot<
  TPair extends PairLike,
  TGroup extends GroupLike<TPair, LargoMatchLike>,
>(input: {
  grupos: TGroup[];
  config: unknown;
}) {
  const groupRankings = computeLargoRankingByGroup(
    input.grupos.map((group) => ({
      id: group.id,
      nombre: group.nombre,
      parejas: toDisplayPairs(group.parejas).map((pair) => ({
        id: pair.id,
        nombre: pair.nombre,
      })),
      partidos: group.partidos.map((match) => ({
        pareja1Id: match.pareja1Id,
        pareja2Id: match.pareja2Id,
        completado: match.completado,
        scoreJson: match.scoreJson,
      })),
    })),
  );
  const qualifiersByGroupSize = resolveLargoQualifiersByGroupSize(input.config);
  const classified = getLargoClassified(groupRankings, qualifiersByGroupSize);

  return {
    groupRankings,
    qualifiersByGroupSize,
    classified,
  };
}

export function toTournamentHeaderProps(torneo: TournamentHeaderSource) {
  const categoriaLabel = getPadelCategoryLabel(torneo.categoriaPadel ?? null);

  return {
    torneoId: torneo.id,
    nombre: torneo.nombre,
    fechaISO: torneo.fecha.toISOString(),
    parejas: torneo._count.parejas,
    estado: torneo.estado as TournamentEstado,
    ...(categoriaLabel ? { categoriaLabel } : {}),
  };
}
