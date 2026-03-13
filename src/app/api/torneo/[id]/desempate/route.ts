import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, ok, parseJson, runApiRoute } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/require-auth";
import { computeTorneoRanking } from "@/lib/tournament-service";

type RouteParams = { params: Promise<{ id: string }> };

const desempateSchema = z.object({
  method: z.enum(["moneda", "tiebreak", "manual"]),
  byeWinnerIds: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: Request, { params }: RouteParams) {
  return runApiRoute(
    request,
    {
      operation: "torneo.tiebreak.resolve",
      fallbackMessage: "No se pudo resolver el desempate.",
    },
    async (context) => {
      const authUser = await requireApiAuth(request);
      context.userId = authUser.userId;

      const { id } = await params;
      const parsed = await parseJson(request, desempateSchema);
      if (!parsed.success) {
        return parsed.response;
      }

      const result = await db.$transaction(async (tx) => {
        const torneo = await tx.torneo.findUnique({ where: { id } });
        if (!torneo) {
          throw new ApiError("Torneo no encontrado.", 404);
        }
        if (torneo.userId !== authUser.userId) {
          throw new ApiError("Torneo no encontrado.", 404);
        }
        if (torneo.formato === "LARGO") {
          throw new ApiError("El formato largo no utiliza desempate manual.", 409);
        }
        if (torneo.estado === "FINALIZADO") {
          throw new ApiError("El torneo esta finalizado y es solo lectura.", 409);
        }

        const { tiebreaks } = await computeTorneoRanking(tx, id, authUser.userId);
        if (!tiebreaks || tiebreaks.parejas.length < 2) {
          throw new ApiError("No hay desempates pendientes para este torneo.", 409);
        }

        const { method, byeWinnerIds } = parsed.data;
        const tiedPairIds = new Set(tiebreaks.parejas.map((p) => p.id));
        const byeSlotsInDispute = tiebreaks.byeSlotsInDispute;

        for (const winnerId of byeWinnerIds) {
          if (!tiedPairIds.has(winnerId)) {
            throw new ApiError("Una o mas parejas ganadoras no pertenecen al grupo empatado.", 400);
          }
        }
        if (byeWinnerIds.length !== byeSlotsInDispute) {
          throw new ApiError(
            `Debes elegir exactamente ${byeSlotsInDispute} pareja${byeSlotsInDispute === 1 ? "" : "s"} ganadora${byeSlotsInDispute === 1 ? "" : "s"}.`,
            400,
          );
        }

        await tx.desempate.deleteMany({ where: { torneoId: id } });

        const winnerSet = new Set(byeWinnerIds);
        const loserIds = tiebreaks.parejas.map((p) => p.id).filter((pId) => !winnerSet.has(pId));
        const dbMetodo = method === "moneda" ? "MONEDA" : "TIEBREAK";

        for (let idx = 0; idx < loserIds.length; idx += 1) {
          const loserId = loserIds[idx];
          const winnerId = byeWinnerIds[idx % byeWinnerIds.length];
          await tx.desempate.create({
            data: {
              torneoId: id,
              pareja1Id: winnerId,
              pareja2Id: loserId,
              ganadorId: winnerId,
              metodo: dbMetodo,
              resuelto: true,
            },
          });
        }

        await tx.torneo.update({
          where: { id },
          data: { estado: "RANKING" },
        });

        return { complete: true, byeWinnerIds, method };
      });

      return ok(result);
    },
  );
}
