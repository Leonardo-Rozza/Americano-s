import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { EditTournamentForm } from "@/components/tournament/EditTournamentForm";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function EditTorneoPage({ params }: RouteParams) {
  const { id } = await params;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      parejas: {
        orderBy: { id: "asc" },
        select: { id: true, nombre: true },
      },
    },
  });

  if (!torneo) {
    notFound();
  }

  if (torneo.estado === "FINALIZADO") {
    redirect(`/torneo/${torneo.id}/bracket`);
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">Editar Torneo</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Ajusta nombre, metodo de desempate y nombres de parejas.
        </p>
      </header>

      <EditTournamentForm
        torneoId={torneo.id}
        initialNombre={torneo.nombre}
        initialMetodo={torneo.metodoDesempate}
        initialParejas={torneo.parejas}
        estado={torneo.estado}
      />
    </section>
  );
}
