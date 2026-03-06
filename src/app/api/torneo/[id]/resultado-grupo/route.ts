import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok, parseJson } from "@/lib/api";
import { generateRound2IfNeeded, getTorneoOrThrow } from "@/lib/tournament-service";
import { isValidMatchScore } from "@/lib/score-utils";

type RouteParams = { params: Promise<{ id: string }> };

const resultSchema = z.object({
  partidoId: z.string().trim().min(1),
  gamesPareja1: z.number().int().min(0),
  gamesPareja2: z.number().int().min(0),
});

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const parsed = await parseJson(request, resultSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    if (!isValidMatchScore(parsed.data.gamesPareja1, parsed.data.gamesPareja2)) {
      throw new ApiError("Resultado invalido. Debe ser 6-x (x entre 0 y 5).", 400);
    }

    await db.$transaction(async (tx) => {
      const match = await tx.partidoGrupo.findUnique({
        where: { id: parsed.data.partidoId },
        include: { grupo: true },
      });
      if (!match || match.grupo.torneoId !== id) {
        throw new ApiError("Partido de grupo no encontrado para este torneo.", 404);
      }

      await tx.partidoGrupo.update({
        where: { id: parsed.data.partidoId },
        data: {
          gamesPareja1: parsed.data.gamesPareja1,
          gamesPareja2: parsed.data.gamesPareja2,
          completado: true,
        },
      });

      if (match.fase === "RONDA1") {
        await generateRound2IfNeeded(tx, match.grupoId);
      }
    });

    const torneo = await getTorneoOrThrow(db, id);
    return ok(torneo);
  } catch (error) {
    return fromUnknownError(error, "No se pudo guardar el resultado del grupo.");
  }
}
