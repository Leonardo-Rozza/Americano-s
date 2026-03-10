import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok } from "@/lib/api";
import { buildBracket, getBracketSize } from "@/lib/tournament-engine/bracket";
import {
  buildLargoBracket,
  computeLargoRankingByGroup,
  getLargoClassified,
  resolveLargoQualifiersByGroupSize,
} from "@/lib/tournament-engine/largo";
import {
  areAllGroupMatchesComplete,
  collectGroupResults,
  makeGroupRivals,
  resolveRankingWithTiebreak,
} from "@/lib/tournament-service";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { syncBracketProgression } from "@/lib/bracket-progression";
import { requireApiAuth } from "@/lib/auth/require-auth";
import { resolvePairDisplayName } from "@/lib/pair-utils";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireApiAuth(request);
    const { id } = await params;

    // Load data outside the transaction to minimize transaction duration
    const torneo = await db.torneo.findFirst({
      where: { id, userId: authUser.userId },
      include: {
        parejas: { orderBy: { id: "asc" } },
        grupos: {
          include: {
            parejas: { orderBy: { id: "asc" } },
            partidos: true,
          },
        },
        desempates: { orderBy: { id: "asc" } },
        bracket: { include: { matches: true } },
      },
    });

    if (!torneo) {
      throw new ApiError("Torneo no encontrado.", 404);
    }
    if (torneo.estado === "FINALIZADO") {
      throw new ApiError("El torneo esta finalizado y es solo lectura.", 409);
    }
    if (!areAllGroupMatchesComplete(torneo.grupos)) {
      throw new ApiError("Debes completar todos los partidos de grupos antes de generar el bracket.", 409);
    }

    let rankedPairs: Array<{ id: string; nombre: string }> = [];
    let largoClassified:
      | ReturnType<typeof getLargoClassified>
      | null = null;
    if (torneo.formato === "LARGO") {
      const groupRankings = computeLargoRankingByGroup(
        torneo.grupos.map((group) => ({
          id: group.id,
          nombre: group.nombre,
          parejas: group.parejas.map((pair) => ({
            id: pair.id,
            nombre: resolvePairDisplayName(pair),
          })),
          partidos: group.partidos.map((match) => ({
            pareja1Id: match.pareja1Id,
            pareja2Id: match.pareja2Id,
            completado: match.completado,
            scoreJson: match.scoreJson,
          })),
        })),
      );
      const qualifiersByGroupSize = resolveLargoQualifiersByGroupSize(torneo.config);
      const classified = getLargoClassified(groupRankings, qualifiersByGroupSize);
      if (classified.length < 2) {
        throw new ApiError("No hay suficientes parejas clasificadas para generar eliminatoria.", 409);
      }
      largoClassified = classified;
      rankedPairs = [...classified]
        .sort((a, b) => {
          if (a.position !== b.position) {
            return a.position - b.position;
          }
          return a.groupName.localeCompare(b.groupName);
        })
        .map((item) => item.pareja);
    } else {
      const rankingBase = computeRanking(
        torneo.parejas.map((pair) => ({ id: pair.id, nombre: resolvePairDisplayName(pair) })),
        collectGroupResults(torneo.grupos),
      );
      const byes = getBracketSize(rankingBase.length) - rankingBase.length;
      const tiebreaks = detectTiebreaks(rankingBase, byes);
      const tiebreakResolution = resolveRankingWithTiebreak(rankingBase, tiebreaks, torneo.desempates);
      if (tiebreakResolution.tiebreakPending) {
        throw new ApiError("Hay desempates pendientes. Resolve eso antes de generar el bracket.", 409);
      }
      rankedPairs = tiebreakResolution.ranking.map((entry) => entry.pareja);
    }

    const bracketSize = getBracketSize(rankedPairs.length);
    const useStrictFirstRoundSeeding =
      rankedPairs.length === bracketSize && (bracketSize === 8 || bracketSize === 16);
    const groupRivals = makeGroupRivals(torneo.grupos);
    const rounds =
      torneo.formato === "LARGO" && largoClassified
        ? buildLargoBracket(largoClassified, groupRivals, {
            strictFirstRoundSeeding: useStrictFirstRoundSeeding,
          })
        : buildBracket(rankedPairs, groupRivals, {
            strictFirstRoundSeeding: useStrictFirstRoundSeeding,
          });
    const totalRondas = Math.log2(bracketSize);

    // Build flat match list with placeholder IDs for syncBracketProgression
    const rawMatches = rounds.flatMap((round) =>
      round.map((match) => {
        const onlyTeam = match.t1 ? (match.t2 ? null : match.t1) : match.t2;
        return {
          id: `${match.round}:${match.idx}`,
          ronda: match.round,
          posicion: match.idx,
          esBye: match.isBye,
          pareja1Id: match.t1?.id ?? null,
          pareja2Id: match.t2?.id ?? null,
          ganadorId: onlyTeam?.id ?? null,
          gamesPareja1: null as number | null,
          gamesPareja2: null as number | null,
          completado: Boolean(onlyTeam),
        };
      }),
    );

    // Compute final synced state before any DB write — eliminates second-pass updates
    const synced = syncBracketProgression(rawMatches, totalRondas);
    // Single transaction: only DB writes, no heavy computation
    const payload = await db.$transaction(
      async (tx) => {
        if (torneo.bracket) {
          await tx.bracketMatch.deleteMany({ where: { bracketId: torneo.bracket.id } });
          await tx.bracket.delete({ where: { id: torneo.bracket.id } });
        }

        const bracket = await tx.bracket.create({
          data: { torneoId: id, tamano: bracketSize, totalRondas },
        });

        await tx.bracketMatch.createMany({
          data: synced.map((match) => ({
            bracketId: bracket.id,
            ronda: match.ronda,
            posicion: match.posicion,
            esBye: match.esBye,
            pareja1Id: match.pareja1Id,
            pareja2Id: match.pareja2Id,
            ganadorId: match.ganadorId,
            gamesPareja1: match.gamesPareja1,
            gamesPareja2: match.gamesPareja2,
            walkover: false,
            completado: match.completado,
          })),
        });

        await tx.torneo.update({ where: { id }, data: { estado: "ELIMINATORIA" } });

        return tx.bracket.findUnique({
          where: { id: bracket.id },
          include: { matches: { orderBy: [{ ronda: "asc" }, { posicion: "asc" }] } },
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );

    return ok(payload);
  } catch (error) {
    return fromUnknownError(error, "No se pudo generar el bracket.");
  }
}
