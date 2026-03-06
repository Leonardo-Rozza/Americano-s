import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GroupStageClient } from "@/components/tournament/GroupStageClient";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function GruposPage({ params }: RouteParams) {
  const { id } = await params;

  const torneo = await db.torneo.findUnique({
    where: { id },
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
        grupos: torneo.grupos,
      }}
      readOnly={torneo.estado === "FINALIZADO"}
    />
  );
}
