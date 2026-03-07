import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok } from "@/lib/api";
import { areAllGroupMatchesComplete, computeTorneoRanking } from "@/lib/tournament-service";
import { requireApiAuth } from "@/lib/auth/require-auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireApiAuth(request);
    const { id } = await params;
    const payload = await db.$transaction(async (tx) => {
      const { torneo, ranking, tiebreaks } = await computeTorneoRanking(tx, id, authUser.userId);
      if (torneo.estado === "FINALIZADO") {
        throw new ApiError("El torneo esta finalizado y es solo lectura.", 409);
      }
      if (!areAllGroupMatchesComplete(torneo.grupos)) {
        throw new ApiError("Debes completar todos los partidos de grupos antes de calcular el ranking.", 409);
      }

      const desempates: Array<{ id: string; pareja1Id: string; pareja2Id: string }> = [];
      await tx.desempate.deleteMany({
        where: { torneoId: id, resuelto: false },
      });

      if (tiebreaks) {
        const pairs = tiebreaks.parejas;
        for (let i = 0; i < pairs.length; i += 1) {
          for (let j = i + 1; j < pairs.length; j += 1) {
            const created = await tx.desempate.create({
              data: {
                torneoId: id,
                pareja1Id: pairs[i].id,
                pareja2Id: pairs[j].id,
                metodo: torneo.metodoDesempate,
              },
            });
            desempates.push(created);
          }
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
