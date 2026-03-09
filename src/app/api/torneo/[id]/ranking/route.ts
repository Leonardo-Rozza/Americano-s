import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok } from "@/lib/api";
import { areAllGroupMatchesComplete, computeTorneoRanking } from "@/lib/tournament-service";
import {
  computeLargoRankingByGroup,
  getLargoClassified,
  resolveLargoQualifiersByGroupSize,
} from "@/lib/tournament-engine/largo";
import { resolvePairDisplayName } from "@/lib/pair-utils";
import { requireApiAuth } from "@/lib/auth/require-auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireApiAuth(request);
    const { id } = await params;
    const payload = await db.$transaction(async (tx) => {
      const torneoBase = await tx.torneo.findUnique({
        where: { id },
        select: { id: true, estado: true, userId: true, formato: true, metodoDesempate: true },
      });
      if (!torneoBase || torneoBase.userId !== authUser.userId) {
        throw new ApiError("Torneo no encontrado.", 404);
      }
      if (torneoBase.estado === "FINALIZADO") {
        throw new ApiError("El torneo esta finalizado y es solo lectura.", 409);
      }

      if (torneoBase.formato === "LARGO") {
        const torneoLargo = await tx.torneo.findUnique({
          where: { id },
          include: {
            grupos: {
              include: {
                parejas: { orderBy: { nombre: "asc" } },
                partidos: true,
              },
            },
            parejas: { orderBy: { id: "asc" } },
          },
        });

        if (!torneoLargo) {
          throw new ApiError("Torneo no encontrado.", 404);
        }
        if (!areAllGroupMatchesComplete(torneoLargo.grupos)) {
          throw new ApiError("Debes completar todos los partidos de zonas antes de calcular el ranking.", 409);
        }

        const groupRankings = computeLargoRankingByGroup(
          torneoLargo.grupos.map((group) => ({
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
        const qualifiersByGroupSize = resolveLargoQualifiersByGroupSize(torneoLargo.config);
        const classified = getLargoClassified(groupRankings, qualifiersByGroupSize);
        const seedingOrder = [...classified].sort((a, b) => {
          if (a.position !== b.position) {
            return a.position - b.position;
          }
          return a.groupName.localeCompare(b.groupName);
        });

        await tx.pareja.updateMany({
          where: { torneoId: id },
          data: { seed: null },
        });
        for (let seed = 0; seed < seedingOrder.length; seed += 1) {
          await tx.pareja.update({
            where: { id: seedingOrder[seed].pareja.id },
            data: { seed: seed + 1 },
          });
        }

        await tx.torneo.update({
          where: { id },
          data: { estado: "RANKING" },
        });

        return {
          mode: "LARGO" as const,
          groupRankings,
          classified,
          qualifiersByGroupSize,
        };
      }

      const { torneo, ranking, tiebreaks } = await computeTorneoRanking(tx, id, authUser.userId);
      if (!areAllGroupMatchesComplete(torneo.grupos)) {
        throw new ApiError("Debes completar todos los partidos de grupos antes de calcular el ranking.", 409);
      }

      const desempates: Array<{ id: string; pareja1Id: string; pareja2Id: string }> = [];
      await tx.desempate.deleteMany({
        where: { torneoId: id },
      });

      if (tiebreaks) {
        const pairs = tiebreaks.parejas;
        if (pairs.length >= 2) {
          const created = await tx.desempate.create({
            data: {
              torneoId: id,
              pareja1Id: pairs[0].id,
              pareja2Id: pairs[1].id,
              metodo: torneo.metodoDesempate,
            },
          });
          desempates.push(created);
        }
      }

      await tx.pareja.updateMany({
        where: { torneoId: id },
        data: { seed: null },
      });
      for (let seed = 0; seed < ranking.length; seed += 1) {
        await tx.pareja.update({
          where: { id: ranking[seed].pareja.id },
          data: { seed: seed + 1 },
        });
      }

      await tx.torneo.update({
        where: { id },
        data: { estado: tiebreaks ? "DESEMPATE" : "RANKING" },
      });

      return {
        mode: "AMERICANO" as const,
        ranking,
        tiebreaks: tiebreaks
          ? {
              ...tiebreaks,
              desempates,
            }
          : undefined,
      };
    });

    return ok(payload);
  } catch (error) {
    return fromUnknownError(error, "No se pudo calcular el ranking.");
  }
}
