import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GroupStageClient } from "@/components/tournament/GroupStageClient";
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

  return (
    <GroupStageClient
      torneo={{
        id: torneo.id,
        nombre: torneo.nombre,
        grupos: torneo.grupos.map((group) => ({
          ...group,
          parejas: group.parejas.map((pair) => ({
            id: pair.id,
            nombre: resolvePairDisplayName(pair),
          })),
        })),
      }}
      readOnly={torneo.estado === "FINALIZADO"}
    />
  );
}
