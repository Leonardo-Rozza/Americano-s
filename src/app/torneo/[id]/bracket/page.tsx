import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BracketClient } from "@/components/tournament/BracketClient";
import { GoToBracketButton } from "@/components/tournament/GoToBracketButton";

type RouteParams = { params: Promise<{ id: string }> };
type RouteSearchParams = { searchParams: Promise<{ view?: string }> };

export const dynamic = "force-dynamic";

export default async function BracketPage({ params, searchParams }: RouteParams & RouteSearchParams) {
  const { id } = await params;
  const query = await searchParams;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      parejas: {
        select: { id: true, nombre: true },
      },
      bracket: {
        include: {
          matches: {
            orderBy: [{ ronda: "asc" }, { posicion: "asc" }],
          },
        },
      },
    },
  });

  if (!torneo) {
    notFound();
  }

  const publicView = query.view === "public";

  return (
    <section>
      {torneo.bracket ? (
        <BracketClient
          torneoId={id}
          torneoNombre={torneo.nombre}
          pairs={torneo.parejas}
          readOnly={publicView}
          bracket={{
            id: torneo.bracket.id,
            totalRondas: torneo.bracket.totalRondas,
            matches: torneo.bracket.matches,
          }}
        />
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">Aun no hay cuadro generado</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Generalo desde ranking para comenzar eliminatorias.</p>
          <div className="mt-5">
            <GoToBracketButton torneoId={id} hasBracket={false} />
          </div>
          <div className="mt-4">
            <Link
              href={`/torneo/${id}/ranking`}
              className="text-sm font-semibold text-[var(--text-dim)] transition hover:text-[var(--text)]"
            >
              Volver a ranking
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}
