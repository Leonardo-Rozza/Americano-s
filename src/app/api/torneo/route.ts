import { z } from "zod";
import { db } from "@/lib/db";
import { fail, fromUnknownError, ok, parseJson } from "@/lib/api";
import { createTorneoWithGroups, getTorneoOrThrow } from "@/lib/tournament-service";

const createTorneoSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es requerido."),
    numParejas: z.number().int().min(3, "Se requieren al menos 3 parejas."),
    metodoDesempate: z.enum(["MONEDA", "TIEBREAK"]),
    useNames: z.boolean(),
    nombres: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.useNames && (!value.nombres || value.nombres.length !== value.numParejas)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Si useNames=true, nombres debe tener exactamente numParejas elementos.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const parsed = await parseJson(request, createTorneoSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const pairNames = parsed.data.useNames
      ? parsed.data.nombres!
      : Array.from({ length: parsed.data.numParejas }, (_, idx) => `Pareja ${idx + 1}`);

    const torneoId = await db.$transaction((tx) =>
      createTorneoWithGroups(tx, {
        nombre: parsed.data.nombre,
        numParejas: parsed.data.numParejas,
        metodoDesempate: parsed.data.metodoDesempate,
        pairNames,
      }),
    );

    const torneo = await getTorneoOrThrow(db, torneoId);
    return ok(torneo, 201);
  } catch (error) {
    return fromUnknownError(error, "No se pudo crear el torneo.");
  }
}

export async function GET() {
  return fail("Metodo no soportado.", 405);
}
