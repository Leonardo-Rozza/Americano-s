import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok } from "@/lib/api";
import { buildBracket, getBracketSize } from "@/lib/tournament-engine/bracket";
import { collectGroupResults, makeGroupRivals } from "@/lib/tournament-service";
import { computeRanking } from "@/lib/tournament-engine/ranking";
import { syncBracketProgression } from "@/lib/bracket-progression";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const payload = await db.$transaction(async (tx) => {
      const torneo = await tx.torneo.findUnique({
        where: { id },
        include: {
          parejas: { orderBy: { id: "asc" } },
          grupos: {
            include: {
              parejas: { orderBy: { id: "asc" } },
              partidos: true,
            },
          },
          desempates: {
            where: { resuelto: false },
          },
          bracket: {
            include: { matches: true },
          },
        },
      });
      if (!torneo) {
        throw new ApiError("Torneo no encontrado.", 404);
      }
      if (torneo.desempates.length > 0) {
        throw new ApiError("Hay desempates pendientes. Resolve eso antes de generar el bracket.", 409);
      }

      const ranking = computeRanking(
        torneo.parejas.map((pair) => ({ id: pair.id, nombre: pair.nombre })),
        collectGroupResults(torneo.grupos),
      );
      const rankedPairs = ranking.map((entry) => entry.pareja);
      const groupRivals = makeGroupRivals(torneo.grupos);
      const rounds = buildBracket(rankedPairs, groupRivals);
      const bracketSize = getBracketSize(rankedPairs.length);
      const totalRondas = Math.log2(bracketSize);

      if (torneo.bracket) {
        await tx.bracketMatch.deleteMany({ where: { bracketId: torneo.bracket.id } });
        await tx.bracket.delete({ where: { id: torneo.bracket.id } });
      }

      const bracket = await tx.bracket.create({
        data: {
          torneoId: id,
          tamano: bracketSize,
          totalRondas,
        },
      });

      for (let seed = 0; seed < ranking.length; seed += 1) {
        await tx.pareja.update({
          where: { id: ranking[seed].pareja.id },
          data: { seed: seed + 1 },
        });
      }

      for (const round of rounds) {
        for (const match of round) {
          const onlyTeam = match.t1 ? (match.t2 ? null : match.t1) : match.t2;
          await tx.bracketMatch.create({
            data: {
              bracketId: bracket.id,
              ronda: match.round,
              posicion: match.idx,
              esBye: match.isBye,
              pareja1Id: match.t1?.id ?? null,
              pareja2Id: match.t2?.id ?? null,
              ganadorId: onlyTeam?.id ?? null,
              completado: Boolean(onlyTeam),
            },
          });
        }
      }

      const insertedMatches = await tx.bracketMatch.findMany({
        where: { bracketId: bracket.id },
        orderBy: [{ ronda: "asc" }, { posicion: "asc" }],
      });
      const synced = syncBracketProgression(insertedMatches, totalRondas);
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

      await tx.torneo.update({
        where: { id },
        data: { estado: "ELIMINATORIA" },
      });

      return tx.bracket.findUnique({
        where: { id: bracket.id },
        include: { matches: { orderBy: [{ ronda: "asc" }, { posicion: "asc" }] } },
      });
    });

    return ok(payload);
  } catch (error) {
    return fromUnknownError(error, "No se pudo generar el bracket.");
  }
}
