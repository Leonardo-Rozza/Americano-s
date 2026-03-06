import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok, parseJson } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

const byIdSchema = z.object({
  desempateId: z.string().trim().min(1),
  ganadorId: z.string().trim().min(1),
  finalizar: z.boolean().optional(),
});

const byPairSchema = z.object({
  pareja1Id: z.string().trim().min(1),
  pareja2Id: z.string().trim().min(1),
  ganadorId: z.string().trim().min(1),
  finalizar: z.boolean().optional(),
});

const desempateSchema = z.union([byIdSchema, byPairSchema]);

export async function POST(request: Request, { params }: RouteParams) {
  try {
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

      const data = parsed.data;
      const resolvedById = "desempateId" in data;
      let desempate = null;

      if (resolvedById) {
        const byIdInput = data as z.infer<typeof byIdSchema>;
        desempate = await tx.desempate.findUnique({
          where: { id: byIdInput.desempateId },
        });
      } else {
        const byPairInput = data as z.infer<typeof byPairSchema>;
        desempate = await tx.desempate.findFirst({
          where: {
            torneoId: id,
            resuelto: false,
            OR: [
              {
                pareja1Id: byPairInput.pareja1Id,
                pareja2Id: byPairInput.pareja2Id,
              },
              {
                pareja1Id: byPairInput.pareja2Id,
                pareja2Id: byPairInput.pareja1Id,
              },
            ],
          },
        });
      }

      const pair1Id = desempate
        ? desempate.pareja1Id
        : resolvedById
          ? null
          : (data as z.infer<typeof byPairSchema>).pareja1Id;
      const pair2Id = desempate
        ? desempate.pareja2Id
        : resolvedById
          ? null
          : (data as z.infer<typeof byPairSchema>).pareja2Id;

      if (!pair1Id || !pair2Id) {
        throw new ApiError("No se pudo resolver el duelo de desempate.", 400);
      }
      if (![pair1Id, pair2Id].includes(data.ganadorId)) {
        throw new ApiError("El ganador no pertenece al desempate.", 400);
      }

      const updated =
        desempate && !desempate.resuelto
          ? await tx.desempate.update({
                where: { id: desempate.id },
                data: {
                ganadorId: data.ganadorId,
                resuelto: true,
              },
            })
          : await tx.desempate.create({
              data: {
                torneoId: id,
                pareja1Id: pair1Id,
                pareja2Id: pair2Id,
                ganadorId: data.ganadorId,
                metodo: torneo.metodoDesempate,
                resuelto: true,
              },
            });

      if (data.finalizar) {
        await tx.desempate.updateMany({
          where: {
            torneoId: id,
            resuelto: false,
          },
          data: { resuelto: true },
        });
      }

      const pending = await tx.desempate.count({
        where: { torneoId: id, resuelto: false },
      });
      if (pending === 0) {
        await tx.torneo.update({
          where: { id },
          data: { estado: "RANKING" },
        });
      }

      return { desempate: updated, pending };
    });

    return ok(result);
  } catch (error) {
    return fromUnknownError(error, "No se pudo resolver el desempate.");
  }
}
