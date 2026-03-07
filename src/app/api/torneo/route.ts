import { z } from "zod";
import { db } from "@/lib/db";
import { fail, fromUnknownError, ok, parseJson } from "@/lib/api";
import { createTorneoWithGroups, getTorneoOrThrow } from "@/lib/tournament-service";
import { isValidGroupConfig } from "@/lib/tournament-engine/groups";
import { areSamePlayers, isValidPlayerName } from "@/lib/pair-utils";
import { requireApiAuth } from "@/lib/auth/require-auth";

const pairInputSchema = z
  .object({
    jugador1: z.string().trim().min(1, "Nombre 1 es obligatorio."),
    jugador2: z.string().trim().min(1, "Nombre 2 es obligatorio."),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isValidPlayerName(value.jugador1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jugador1"],
        message: "Nombre 1 tiene formato invalido.",
      });
    }
    if (!isValidPlayerName(value.jugador2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jugador2"],
        message: "Nombre 2 tiene formato invalido.",
      });
    }
    if (areSamePlayers(value.jugador1, value.jugador2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jugador2"],
        message: "Nombre 1 y Nombre 2 no pueden ser iguales.",
      });
    }
  });

const createTorneoSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es requerido."),
    numParejas: z
      .number()
      .int()
      .min(6, "Se requieren al menos 6 parejas.")
      .max(30, "El maximo permitido es 30 parejas."),
    metodoDesempate: z.enum(["MONEDA", "TIEBREAK"]).optional().default("MONEDA"),
    pairMode: z.enum(["CUSTOM", "GENERIC"]).default("CUSTOM"),
    parejas: z.array(pairInputSchema).optional(),
    formatoGrupos: z
      .object({
        g3: z.number().int().min(0),
        g4: z.number().int().min(0),
      })
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.pairMode === "CUSTOM") {
      if (!value.parejas || value.parejas.length !== value.numParejas) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debes enviar exactamente numParejas parejas en modo personalizado.",
        });
      }
    }

    if (value.pairMode === "GENERIC" && value.parejas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No debes enviar parejas manuales en modo generico.",
      });
    }

    if (value.formatoGrupos && !isValidGroupConfig(value.numParejas, value.formatoGrupos)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El formato de grupos no es valido para la cantidad de parejas seleccionada.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const authUser = await requireApiAuth(request);
    const parsed = await parseJson(request, createTorneoSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const torneoId = await db.$transaction((tx) =>
      createTorneoWithGroups(tx, {
        userId: authUser.userId,
        nombre: parsed.data.nombre,
        numParejas: parsed.data.numParejas,
        metodoDesempate: parsed.data.metodoDesempate,
        pairMode: parsed.data.pairMode,
        pairPlayers: parsed.data.parejas,
        groupConfig: parsed.data.formatoGrupos,
      }),
    );

    const torneo = await getTorneoOrThrow(db, torneoId, authUser.userId);
    return ok(torneo, 201);
  } catch (error) {
    return fromUnknownError(error, "No se pudo crear el torneo.");
  }
}

export async function GET() {
  return fail("Metodo no soportado.", 405);
}
