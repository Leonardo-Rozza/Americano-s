import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, ok, parseJson, runApiRoute } from "@/lib/api";
import { syncBracketProgression } from "@/lib/bracket-progression";
import { isValidMatchScore } from "@/lib/score-utils";
import {
  getPadelLargoMatchStats,
  getPadelLargoWinner,
  parsePadelLargoScore,
  validatePadelLargoScore,
} from "@/lib/tournament-engine/scoring/padel-largo";
import { requireApiAuth } from "@/lib/auth/require-auth";

type RouteParams = { params: Promise<{ id: string }> };

const americanoResultSchema = z.object({
  matchId: z.string().trim().min(1),
  gamesPareja1: z.number().int().min(0),
  gamesPareja2: z.number().int().min(0),
});

const largoResultSchema = z.object({
  matchId: z.string().trim().min(1),
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

function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function jsonFingerprint(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function reSyncBracket(tx: Prisma.TransactionClient, bracketId: string, totalRounds: number) {
  const matches = await tx.bracketMatch.findMany({
    where: { bracketId },
    orderBy: [{ ronda: "asc" }, { posicion: "asc" }],
  });
  const synced = syncBracketProgression(matches, totalRounds);
  const currentById = new Map(matches.map((match) => [match.id, match]));

  const changed = synced.filter((next) => {
    const current = currentById.get(next.id);
    if (!current) {
      return true;
    }

    return (
      current.esBye !== next.esBye ||
      current.pareja1Id !== next.pareja1Id ||
      current.pareja2Id !== next.pareja2Id ||
      current.ganadorId !== next.ganadorId ||
      current.gamesPareja1 !== next.gamesPareja1 ||
      current.gamesPareja2 !== next.gamesPareja2 ||
      jsonFingerprint(current.scoreJson) !== jsonFingerprint(next.scoreJson) ||
      Boolean(current.walkover) !== Boolean(next.walkover) ||
      current.completado !== next.completado
    );
  });

  for (const match of changed) {
    await tx.bracketMatch.update({
      where: { id: match.id },
      data: {
        esBye: match.esBye,
        pareja1Id: match.pareja1Id,
        pareja2Id: match.pareja2Id,
        ganadorId: match.ganadorId,
        gamesPareja1: match.gamesPareja1,
        gamesPareja2: match.gamesPareja2,
        scoreJson: toJsonInput(match.scoreJson),
        walkover: Boolean(match.walkover),
        completado: match.completado,
      },
    });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  return runApiRoute(
    request,
    {
      operation: "torneo.bracket_result.update",
      fallbackMessage: "No se pudo guardar el resultado del bracket.",
    },
    async (context) => {
      const authUser = await requireApiAuth(request);
      context.userId = authUser.userId;

      const { id } = await params;
      const parsed = await parseJson(request, resultSchema);
      if (!parsed.success) {
        return parsed.response;
      }

      const payload = await db.$transaction(
        async (tx) => {
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

          if (torneo.formato === "AMERICANO") {
            if (!isAmericanoPayload(parsed.data)) {
              throw new ApiError("Formato de payload invalido para torneo americano.", 400);
            }
            if (!isValidMatchScore(parsed.data.gamesPareja1, parsed.data.gamesPareja2)) {
              throw new ApiError("Resultado invalido. Debe ser 6-x (x entre 0 y 5).", 400);
            }

            const winnerId =
              parsed.data.gamesPareja1 > parsed.data.gamesPareja2 ? match.pareja1Id : match.pareja2Id;
            await tx.bracketMatch.update({
              where: { id: match.id },
              data: {
                gamesPareja1: parsed.data.gamesPareja1,
                gamesPareja2: parsed.data.gamesPareja2,
                scoreJson: Prisma.JsonNull,
                walkover: false,
                ganadorId: winnerId,
                completado: true,
              },
            });
          } else if (torneo.formato === "LARGO") {
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

            const winner = getPadelLargoWinner(score);
            if (!winner) {
              throw new ApiError("No se pudo determinar el ganador del partido.", 400);
            }
            const stats = getPadelLargoMatchStats(score);

            await tx.bracketMatch.update({
              where: { id: match.id },
              data: {
                gamesPareja1: stats.gamesP1,
                gamesPareja2: stats.gamesP2,
                scoreJson: score as Prisma.InputJsonValue,
                walkover: Boolean(score.walkover),
                ganadorId: winner === "p1" ? match.pareja1Id : match.pareja2Id,
                completado: true,
              },
            });
          } else {
            throw new ApiError("Formato de torneo no soportado.", 409);
          }

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
        },
        { maxWait: 10000, timeout: 20000 },
      );

      return ok(payload);
    },
  );
}
