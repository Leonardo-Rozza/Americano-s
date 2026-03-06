import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, fromUnknownError, ok, parseJson } from "@/lib/api";
import { getTorneoOrThrow } from "@/lib/tournament-service";

type RouteParams = { params: Promise<{ id: string }> };
const updateTorneoSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    metodoDesempate: z.enum(["MONEDA", "TIEBREAK"]).optional(),
    parejas: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          nombre: z.string().trim().min(1),
        }),
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.nombre && !value.metodoDesempate && !value.parejas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes enviar al menos un campo para actualizar.",
      });
    }
  });

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

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const parsed = await parseJson(request, updateTorneoSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    await db.$transaction(async (tx) => {
      const torneo = await tx.torneo.findUnique({
        where: { id },
        include: {
          parejas: {
            select: { id: true },
            orderBy: { id: "asc" },
          },
        },
      });
      if (!torneo) {
        throw new ApiError("Torneo no encontrado.", 404);
      }
      if (torneo.estado === "FINALIZADO") {
        throw new ApiError("No se puede editar un torneo finalizado.", 409);
      }

      if (parsed.data.parejas) {
        if (parsed.data.parejas.length !== torneo.parejas.length) {
          throw new ApiError("La cantidad de parejas enviada no coincide con el torneo.", 400);
        }

        const existingIds = new Set(torneo.parejas.map((pair) => pair.id));
        const incomingIds = new Set<string>();
        for (const pair of parsed.data.parejas) {
          if (!existingIds.has(pair.id)) {
            throw new ApiError("Se envio una pareja que no pertenece al torneo.", 400);
          }
          if (incomingIds.has(pair.id)) {
            throw new ApiError("Hay parejas repetidas en la actualizacion.", 400);
          }
          incomingIds.add(pair.id);
        }
      }

      const torneoData: {
        nombre?: string;
        metodoDesempate?: "MONEDA" | "TIEBREAK";
      } = {};
      if (parsed.data.nombre) {
        torneoData.nombre = parsed.data.nombre;
      }
      if (parsed.data.metodoDesempate) {
        torneoData.metodoDesempate = parsed.data.metodoDesempate;
      }
      if (Object.keys(torneoData).length > 0) {
        await tx.torneo.update({
          where: { id },
          data: torneoData,
        });
      }

      if (parsed.data.metodoDesempate) {
        await tx.desempate.updateMany({
          where: { torneoId: id, resuelto: false },
          data: { metodo: parsed.data.metodoDesempate },
        });
      }

      if (parsed.data.parejas) {
        for (const pair of parsed.data.parejas) {
          await tx.pareja.update({
            where: { id: pair.id },
            data: { nombre: pair.nombre },
          });
        }
      }
    });

    const torneo = await getTorneoOrThrow(db, id);
    return ok(torneo);
  } catch (error) {
    return fromUnknownError(error, "No se pudo actualizar el torneo.");
  }
}
