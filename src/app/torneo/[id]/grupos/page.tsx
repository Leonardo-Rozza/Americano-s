import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GroupStageClient } from "@/components/tournament/GroupStageClient";
import { LargoGroupStageClient } from "@/components/tournament/LargoGroupStageClient";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { resolvePairDisplayName } from "@/lib/pair-utils";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function GruposPage({ params }: RouteParams) {
  const authUser = await requirePageAuth();
  const { id } = await params;

  const torneo = await db.torneo.findFirst({
    where: {
      id,
      userId: authUser.userId,
    },
    include: {
      grupos: {
        orderBy: { nombre: "asc" },
        include: {
          parejas: { orderBy: { nombre: "asc" } },
          partidos: { orderBy: [{ fase: "asc" }, { orden: "asc" }] },
        },
      },
    },
  });

  if (!torneo) {
    notFound();
  }

  const torneoView = {
    id: torneo.id,
    nombre: torneo.nombre,
    formato: torneo.formato,
    config: (torneo.config as Record<string, unknown> | null) ?? null,
    grupos: torneo.grupos.map((group) => ({
      ...group,
      parejas: group.parejas.map((pair) => ({
        id: pair.id,
        nombre: resolvePairDisplayName(pair),
      })),
    })),
  };

  if (torneo.formato === "LARGO" && torneo.deporte === "PADEL") {
    return <LargoGroupStageClient torneo={torneoView} readOnly={torneo.estado === "FINALIZADO"} />;
  }

  return (
    <GroupStageClient
      torneo={torneoView}
      readOnly={torneo.estado === "FINALIZADO"}
    />
  );
}
