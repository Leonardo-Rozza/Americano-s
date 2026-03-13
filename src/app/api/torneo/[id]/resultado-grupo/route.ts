import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, ok, parseJson, runApiRoute } from "@/lib/api";
import { generateRound2IfNeeded, getTorneoOrThrow } from "@/lib/tournament-service";
import { isValidMatchScore } from "@/lib/score-utils";
import {
  getPadelLargoMatchStats,
  parsePadelLargoScore,
  validatePadelLargoScore,
} from "@/lib/tournament-engine/scoring/padel-largo";
import { requireApiAuth } from "@/lib/auth/require-auth";

type RouteParams = { params: Promise<{ id: string }> };

const americanoResultSchema = z.object({
  partidoId: z.string().trim().min(1),
  gamesPareja1: z.number().int().min(0),
  gamesPareja2: z.number().int().min(0),
});

const largoResultSchema = z.object({
  partidoId: z.string().trim().min(1),
  score: z.unknown(),
});

const resultSchema = z.union([americanoResultSchema, largoResultSchema]);

function isAmericanoPayload(
  payload: z.infer<typeof resultSchema>,
): payload is z.infer<typeof americanoResultSchema> {
  return "gamesPareja1" in payload && "gamesPareja2" in payload;
}

function readAllowSuperTiebreak(config: Prisma.JsonValue | null): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  return Boolean((config as Record<string, unknown>).superTiebreakTercerSet);
}

export async function PUT(request: Request, { params }: RouteParams) {
  return runApiRoute(
    request,
    {
      operation: "torneo.group_result.update",
      fallbackMessage: "No se pudo guardar el resultado del grupo.",
    },
    async (context) => {
      const authUser = await requireApiAuth(request);
      context.userId = authUser.userId;

      const { id } = await params;
      const parsed = await parseJson(request, resultSchema);
      if (!parsed.success) {
        return parsed.response;
      }

      await db.$transaction(async (tx) => {
        const torneo = await tx.torneo.findUnique({
          where: { id },
          select: { estado: true, userId: true, formato: true, config: true },
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

        const match = await tx.partidoGrupo.findUnique({
          where: { id: parsed.data.partidoId },
          include: { grupo: true },
        });
        if (!match || match.grupo.torneoId !== id) {
          throw new ApiError("Partido de grupo no encontrado para este torneo.", 404);
        }

        if (torneo.formato === "AMERICANO") {
          if (!isAmericanoPayload(parsed.data)) {
            throw new ApiError("Formato de payload invalido para torneo americano.", 400);
          }

          if (!isValidMatchScore(parsed.data.gamesPareja1, parsed.data.gamesPareja2)) {
            throw new ApiError("Resultado invalido. Debe ser 6-x (x entre 0 y 5).", 400);
          }

          await tx.partidoGrupo.update({
            where: { id: parsed.data.partidoId },
            data: {
              gamesPareja1: parsed.data.gamesPareja1,
              gamesPareja2: parsed.data.gamesPareja2,
              scoreJson: Prisma.JsonNull,
              walkover: false,
              completado: true,
            },
          });

          if (match.fase === "RONDA1") {
            await generateRound2IfNeeded(tx, match.grupoId);
          }
          return;
        }

        if (torneo.formato === "LARGO") {
          if (!("score" in parsed.data)) {
            throw new ApiError("Debes enviar score para torneos largos.", 400);
          }

          const score = parsePadelLargoScore(parsed.data.score);
          if (!score) {
            throw new ApiError("Score invalido para torneo largo.", 400);
          }

          const validation = validatePadelLargoScore(score, {
            allowSuperTiebreakThirdSet: readAllowSuperTiebreak(torneo.config),
          });
          if (!validation.valid) {
            throw new ApiError(validation.message, 400);
          }

          const stats = getPadelLargoMatchStats(score);
          await tx.partidoGrupo.update({
            where: { id: parsed.data.partidoId },
            data: {
              gamesPareja1: stats.gamesP1,
              gamesPareja2: stats.gamesP2,
              scoreJson: score as Prisma.InputJsonValue,
              walkover: Boolean(score.walkover),
              completado: true,
            },
          });
          return;
        }

        throw new ApiError("Formato de torneo no soportado.", 409);
      });

      const torneo = await getTorneoOrThrow(db, id, authUser.userId);
      return ok(torneo);
    },
  );
}
