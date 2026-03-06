import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { EditTournamentForm } from "@/components/tournament/EditTournamentForm";
import { isGenericPair, resolvePairPlayers } from "@/lib/pair-utils";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function EditTorneoPage({ params }: RouteParams) {
  const { id } = await params;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      parejas: {
        orderBy: { id: "asc" },
        select: { id: true, nombre: true, jugador1: true, jugador2: true },
      },
    },
  });

  if (!torneo) {
    notFound();
  }

  if (torneo.estado === "FINALIZADO") {
    redirect(`/torneo/${torneo.id}/bracket`);
  }

  const initialPairMode = torneo.parejas.every((pair) => isGenericPair(pair)) ? "GENERIC" : "CUSTOM";

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">Editar Torneo</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Ajusta nombre, metodo de desempate y nombres de jugadores por pareja.
        </p>
      </header>

      <EditTournamentForm
        torneoId={torneo.id}
        initialNombre={torneo.nombre}
        initialMetodo={torneo.metodoDesempate}
        initialPairMode={initialPairMode}
        initialParejas={torneo.parejas.map((pair) => {
          const players = resolvePairPlayers(pair);
          return {
            id: pair.id,
            jugador1: players?.jugador1 ?? "",
            jugador2: players?.jugador2 ?? "",
          };
        })}
        estado={torneo.estado}
      />
    </section>
  );
}
