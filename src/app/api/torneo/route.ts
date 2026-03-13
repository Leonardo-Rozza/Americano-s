import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseJson, runApiRoute } from "@/lib/api";
import { createTorneoWithGroups, getTorneoOrThrow } from "@/lib/tournament-service";
import { isValidGroupConfig } from "@/lib/tournament-engine/groups";
import { isFormatSupportedForSport, isTournamentCombinationEnabled } from "@/lib/tournament-catalog";
import { requireApiAuth } from "@/lib/auth/require-auth";
import { addPairValidationIssues } from "@/lib/pair-input";

const pairInputSchema = z
  .object({
    jugador1: z.string().trim().min(1, "Nombre 1 es obligatorio."),
    jugador2: z.string().trim().min(1, "Nombre 2 es obligatorio."),
  })
  .strict()
  .superRefine((value, ctx) => {
    addPairValidationIssues(value, (field, message) =>
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message,
      }),
    );
  });

const createTorneoSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es requerido."),
    deporte: z.enum(["PADEL", "FUTBOL", "TENIS"]).default("PADEL"),
    formato: z.enum(["AMERICANO", "LARGO", "LIGA"]).default("AMERICANO"),
    numParejas: z
      .number()
      .int()
      .min(6, "Se requieren al menos 6 parejas.")
      .max(30, "El maximo permitido es 30 parejas."),
    metodoDesempate: z.enum(["MONEDA", "TIEBREAK"]).optional().default("MONEDA"),
    pairMode: z.enum(["CUSTOM", "GENERIC"]).default("CUSTOM"),
    parejas: z.array(pairInputSchema).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
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

    if (!isFormatSupportedForSport(value.deporte, value.formato)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El formato seleccionado no esta disponible para ese deporte.",
      });
    }

    if (!isTournamentCombinationEnabled(value.deporte, value.formato)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Por ahora solo estan habilitadas PADEL + AMERICANO y PADEL + LARGO.",
      });
    }

    if (!["AMERICANO", "LARGO"].includes(value.formato) && value.formatoGrupos) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "formatoGrupos solo aplica a formatos con zonas (AMERICANO o LARGO).",
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
  return runApiRoute(
    request,
    {
      operation: "torneo.create",
      fallbackMessage: "No se pudo crear el torneo.",
    },
    async (context) => {
      const authUser = await requireApiAuth(request);
      context.userId = authUser.userId;

      const parsed = await parseJson(request, createTorneoSchema);
      if (!parsed.success) {
        return parsed.response;
      }

      const torneoId = await db.$transaction(
        (tx) =>
          createTorneoWithGroups(tx, {
            userId: authUser.userId,
            nombre: parsed.data.nombre,
            numParejas: parsed.data.numParejas,
            metodoDesempate: parsed.data.metodoDesempate,
            pairMode: parsed.data.pairMode,
            pairPlayers: parsed.data.parejas,
            config: parsed.data.config,
            groupConfig: parsed.data.formatoGrupos,
            deporte: parsed.data.deporte,
            formato: parsed.data.formato,
          }),
        { maxWait: 10000, timeout: 20000 },
      );

      const torneo = await getTorneoOrThrow(db, torneoId, authUser.userId);
      return ok(torneo, 201);
    },
  );
}

export async function GET() {
  return fail("Metodo no soportado.", 405);
}
