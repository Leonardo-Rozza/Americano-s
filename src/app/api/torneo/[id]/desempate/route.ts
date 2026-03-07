import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok, parseJson } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/require-auth";
import { computeTorneoRanking } from "@/lib/tournament-service";
import { buildTiebreakProgress } from "@/lib/tournament-engine/tiebreak";

type RouteParams = { params: Promise<{ id: string }> };

const byIdSchema = z.object({
  desempateId: z.string().trim().min(1),
  ganadorId: z.string().trim().min(1),
});

const byPairSchema = z.object({
  pareja1Id: z.string().trim().min(1),
  pareja2Id: z.string().trim().min(1),
  ganadorId: z.string().trim().min(1),
});

const desempateSchema = z.union([byIdSchema, byPairSchema]);

function isSamePair(a1: string, a2: string, b1: string, b2: string) {
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireApiAuth(request);
    const { id } = await params;
    const parsed = await parseJson(request, desempateSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const result = await db.$transaction(async (tx) => {
      const torneo = await tx.torneo.findUnique({
        where: { id },
      });
      if (!torneo) {
        throw new ApiError("Torneo no encontrado.", 404);
      }
      if (torneo.userId !== authUser.userId) {
        throw new ApiError("Torneo no encontrado.", 404);
      }
      if (torneo.estado === "FINALIZADO") {
        throw new ApiError("El torneo esta finalizado y es solo lectura.", 409);
      }

      const { tiebreaks } = await computeTorneoRanking(tx, id, authUser.userId);
      if (!tiebreaks || tiebreaks.parejas.length < 2) {
        throw new ApiError("No hay desempates pendientes para este torneo.", 409);
      }

      let records = await tx.desempate.findMany({
        where: { torneoId: id },
        orderBy: { id: "asc" },
      });

      let progress = buildTiebreakProgress(tiebreaks, records);
      if (!progress) {
        throw new ApiError("No hay desempates pendientes para este torneo.", 409);
      }
      if (progress.complete || !progress.expectedDuelPairIds) {
        await tx.desempate.deleteMany({
          where: { torneoId: id, resuelto: false },
        });
        await tx.torneo.update({
          where: { id },
          data: { estado: "RANKING" },
        });
        throw new ApiError("No hay desempates pendientes para resolver.", 409);
      }

      let currentDuel = progress.currentDuel;
      if (!currentDuel) {
        await tx.desempate.deleteMany({
          where: { torneoId: id, resuelto: false },
        });
        const [pareja1Id, pareja2Id] = progress.expectedDuelPairIds;
        const created = await tx.desempate.create({
          data: {
            torneoId: id,
            pareja1Id,
            pareja2Id,
            metodo: torneo.metodoDesempate,
          },
        });
        currentDuel = {
          id: created.id,
          pareja1Id: created.pareja1Id,
          pareja2Id: created.pareja2Id,
        };
      }

      const data = parsed.data;
      const resolvedById = "desempateId" in data;
      if (resolvedById) {
        const input = data as z.infer<typeof byIdSchema>;
        if (input.desempateId !== currentDuel.id) {
          throw new ApiError("Debes resolver el duelo de desempate vigente.", 409);
        }
      } else {
        const input = data as z.infer<typeof byPairSchema>;
        if (!isSamePair(input.pareja1Id, input.pareja2Id, currentDuel.pareja1Id, currentDuel.pareja2Id)) {
          throw new ApiError("Debes resolver el duelo de desempate vigente.", 409);
        }
      }
      if (![currentDuel.pareja1Id, currentDuel.pareja2Id].includes(data.ganadorId)) {
        throw new ApiError("El ganador no pertenece al desempate.", 400);
      }

      const updated = await tx.desempate.update({
        where: { id: currentDuel.id },
        data: {
          ganadorId: data.ganadorId,
          resuelto: true,
        },
      });

      records = await tx.desempate.findMany({
        where: { torneoId: id },
        orderBy: { id: "asc" },
      });
      progress = buildTiebreakProgress(tiebreaks, records);
      if (!progress) {
        throw new ApiError("No se pudo actualizar el estado del desempate.", 500);
      }

      if (progress.complete || !progress.expectedDuelPairIds) {
        await tx.desempate.deleteMany({
          where: { torneoId: id, resuelto: false },
        });
        await tx.torneo.update({
          where: { id },
          data: { estado: "RANKING" },
        });

        return {
          desempate: updated,
          pending: 0,
          complete: true,
          nextDuel: null,
        };
      }

      let nextDuel = progress.currentDuel;
      if (!nextDuel) {
        await tx.desempate.deleteMany({
          where: { torneoId: id, resuelto: false },
        });
        const [pareja1Id, pareja2Id] = progress.expectedDuelPairIds;
        const created = await tx.desempate.create({
          data: {
            torneoId: id,
            pareja1Id,
            pareja2Id,
            metodo: torneo.metodoDesempate,
          },
        });
        nextDuel = {
          id: created.id,
          pareja1Id: created.pareja1Id,
          pareja2Id: created.pareja2Id,
        };
      }

      await tx.torneo.update({
        where: { id },
        data: { estado: "DESEMPATE" },
      });

      return {
        desempate: updated,
        pending: 1,
        complete: false,
        nextDuel,
      };
    });

    return ok(result);
  } catch (error) {
    return fromUnknownError(error, "No se pudo resolver el desempate.");
  }
}
