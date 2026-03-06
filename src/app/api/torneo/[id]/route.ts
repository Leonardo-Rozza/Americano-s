import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok } from "@/lib/api";
import { getTorneoOrThrow } from "@/lib/tournament-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const torneo = await getTorneoOrThrow(db, id);
    return ok(torneo);
  } catch (error) {
    return fromUnknownError(error, "No se pudo obtener el torneo.");
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const torneo = await db.torneo.findUnique({ where: { id } });
    if (!torneo) {
      throw new ApiError("Torneo no encontrado.", 404);
    }

    await db.$transaction(async (tx) => {
      const bracket = await tx.bracket.findUnique({
        where: { torneoId: id },
        select: { id: true },
      });

      if (bracket) {
        await tx.bracketMatch.deleteMany({ where: { bracketId: bracket.id } });
        await tx.bracket.delete({ where: { id: bracket.id } });
      }

      await tx.partidoGrupo.deleteMany({
        where: {
          grupo: {
            torneoId: id,
          },
        },
      });

      await tx.desempate.deleteMany({ where: { torneoId: id } });
      await tx.grupo.deleteMany({ where: { torneoId: id } });
      await tx.pareja.deleteMany({ where: { torneoId: id } });
      await tx.torneo.delete({ where: { id } });
    });

    return ok({ deleted: true });
  } catch (error) {
    return fromUnknownError(error, "No se pudo eliminar el torneo.");
  }
}
