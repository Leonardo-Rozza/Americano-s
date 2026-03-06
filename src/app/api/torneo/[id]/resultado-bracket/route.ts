import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok, parseJson } from "@/lib/api";
import { syncBracketProgression } from "@/lib/bracket-progression";
import { isValidMatchScore } from "@/lib/score-utils";

type RouteParams = { params: Promise<{ id: string }> };

const resultSchema = z.object({
  matchId: z.string().trim().min(1),
  gamesPareja1: z.number().int().min(0),
  gamesPareja2: z.number().int().min(0),
});

async function reSyncBracket(tx: Prisma.TransactionClient, bracketId: string, totalRounds: number) {
  const matches = await tx.bracketMatch.findMany({
    where: { bracketId },
    orderBy: [{ ronda: "asc" }, { posicion: "asc" }],
  });
  const synced = syncBracketProgression(matches, totalRounds);

  for (const match of synced) {
    await tx.bracketMatch.update({
      where: { id: match.id },
      data: {
        esBye: match.esBye,
        pareja1Id: match.pareja1Id,
        pareja2Id: match.pareja2Id,
        ganadorId: match.ganadorId,
        gamesPareja1: match.gamesPareja1,
        gamesPareja2: match.gamesPareja2,
        completado: match.completado,
      },
    });
  }
}

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

    const payload = await db.$transaction(async (tx) => {
      const match = await tx.bracketMatch.findUnique({
        where: { id: parsed.data.matchId },
        include: { bracket: true },
      });
      if (!match || match.bracket.torneoId !== id) {
        throw new ApiError("Match de bracket no encontrado para este torneo.", 404);
      }
      if (!match.pareja1Id || !match.pareja2Id) {
        throw new ApiError("El match todavia no tiene ambas parejas cargadas.", 409);
      }

      const winnerId = parsed.data.gamesPareja1 > parsed.data.gamesPareja2 ? match.pareja1Id : match.pareja2Id;
      await tx.bracketMatch.update({
        where: { id: match.id },
        data: {
          gamesPareja1: parsed.data.gamesPareja1,
          gamesPareja2: parsed.data.gamesPareja2,
          ganadorId: winnerId,
          completado: true,
        },
      });

      await reSyncBracket(tx, match.bracketId, match.bracket.totalRondas);

      const finalMatch = await tx.bracketMatch.findFirst({
        where: {
          bracketId: match.bracketId,
          ronda: match.bracket.totalRondas,
          posicion: 0,
        },
      });
      if (finalMatch?.completado) {
        await tx.torneo.update({
          where: { id },
          data: { estado: "FINALIZADO" },
        });
      }

      return tx.bracket.findUnique({
        where: { id: match.bracketId },
        include: { matches: { orderBy: [{ ronda: "asc" }, { posicion: "asc" }] } },
      });
    });

    return ok(payload);
  } catch (error) {
    return fromUnknownError(error, "No se pudo guardar el resultado del bracket.");
  }
}
