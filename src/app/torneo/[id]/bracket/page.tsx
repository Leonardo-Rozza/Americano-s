import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BracketClient } from "@/components/tournament/BracketClient";
import { LargoBracketClient } from "@/components/tournament/LargoBracketClient";
import { GoToBracketButton } from "@/components/tournament/GoToBracketButton";
import { TorneoHeader } from "@/components/tournament/TorneoHeader";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { toDisplayPairs, toTournamentHeaderProps } from "@/lib/tournament-view";

type RouteParams = { params: Promise<{ id: string }> };
type RouteSearchParams = { searchParams: Promise<{ view?: string }> };

export const dynamic = "force-dynamic";

export default async function BracketPage({ params, searchParams }: RouteParams & RouteSearchParams) {
  const { id } = await params;
  const query = await searchParams;
  const publicView = query.view === "public";
  const authUser = publicView ? null : await requirePageAuth();

  const torneo = await db.torneo.findFirst({
    where: {
      id,
      ...(publicView ? {} : { userId: authUser?.userId }),
    },
    include: {
      _count: {
        select: { parejas: true },
      },
      parejas: {
        select: { id: true, nombre: true, jugador1: true, jugador2: true },
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

  const pairs = toDisplayPairs(torneo.parejas).map((pair) => ({
    id: pair.id,
    nombre: pair.nombre,
  }));
  const readOnly = publicView || torneo.estado === "FINALIZADO";

  return (
    <section className="space-y-5">
      <TorneoHeader {...toTournamentHeaderProps(torneo)} publicView={publicView} />

      {torneo.bracket ? (
        torneo.formato === "LARGO" && torneo.deporte === "PADEL" ? (
          <LargoBracketClient
            torneoId={id}
            torneoNombre={torneo.nombre}
            pairs={pairs}
            allowSuperTiebreakThirdSet={Boolean(
              (torneo.config as Record<string, unknown> | null)?.superTiebreakTercerSet,
            )}
            readOnly={readOnly}
            bracket={{
              id: torneo.bracket.id,
              totalRondas: torneo.bracket.totalRondas,
              matches: torneo.bracket.matches,
            }}
          />
        ) : (
          <BracketClient
            torneoId={id}
            torneoNombre={torneo.nombre}
            pairs={pairs}
            readOnly={readOnly}
            bracket={{
              id: torneo.bracket.id,
              totalRondas: torneo.bracket.totalRondas,
              matches: torneo.bracket.matches,
            }}
          />
        )
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">
            {publicView ? "Aun no hay cuadro publicado" : "Aun no hay cuadro generado"}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {publicView
              ? "El organizador todavia no publico la eliminatoria."
              : "Generalo desde ranking para comenzar eliminatorias."}
          </p>

          {publicView ? null : (
            <>
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
            </>
          )}
        </section>
      )}
    </section>
  );
}
