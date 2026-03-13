import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { computePlayerRankingByCategory } from "@/lib/player-ranking";
import { listPadelCategories, parsePadelCategory } from "@/lib/padel-category";

type SearchParams = {
  searchParams: Promise<{
    categoria?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PlayerRankingPage({ searchParams }: SearchParams) {
  const authUser = await requirePageAuth();
  const query = await searchParams;
  const selectedCategory = parsePadelCategory(query.categoria);
  const categories = listPadelCategories();

  const torneos = selectedCategory
    ? await db.torneo.findMany({
        where: {
          userId: authUser.userId,
          deporte: "PADEL",
          estado: "FINALIZADO",
          categoriaPadel: selectedCategory,
        },
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
        include: {
          parejas: {
            select: {
              id: true,
              nombre: true,
              jugador1: true,
              jugador2: true,
            },
          },
          bracket: {
            include: {
              matches: {
                orderBy: [{ ronda: "asc" }, { posicion: "asc" }],
              },
            },
          },
        },
      })
    : [];

  const ranking = selectedCategory
    ? computePlayerRankingByCategory(torneos, selectedCategory)
    : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Americano&apos;s
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text)] md:text-5xl">
            Ranking por jugador
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Ranking individual por categoria, usando solo torneos finalizados con parejas reales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            Dashboard
          </Link>
          <Link
            href="/torneos"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            Mis torneos
          </Link>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Elegi una categoria
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.value}
              href={`/ranking/jugadores?categoria=${category.value}`}
              className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm font-bold transition ${
                selectedCategory === category.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
              }`}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      {!selectedCategory ? (
        <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)]">
          Selecciona una categoria para ver el ranking.
        </section>
      ) : (
        <section className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">Torneos finalizados</p>
              <p className="mt-2 text-3xl font-black text-[var(--text)]">{ranking?.totalFinalizedTournaments ?? 0}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">Torneos incluidos</p>
              <p className="mt-2 text-3xl font-black text-[var(--accent)]">{ranking?.includedTournaments ?? 0}</p>
            </article>
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">Excluidos</p>
              <p className="mt-2 text-3xl font-black text-[var(--gold)]">{ranking?.excludedTournaments ?? 0}</p>
            </article>
          </section>

          {ranking && ranking.rows.length > 0 ? (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                  <thead className="bg-[var(--surface-2)] text-left text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Jugador</th>
                      <th className="px-4 py-3">Puntos</th>
                      <th className="px-4 py-3">Titulos</th>
                      <th className="px-4 py-3">Finales</th>
                      <th className="px-4 py-3">Semis</th>
                      <th className="px-4 py-3">4tos</th>
                      <th className="px-4 py-3">Torneos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {ranking.rows.map((row, index) => (
                      <tr key={row.key} className="text-[var(--text-muted)]">
                        <td className="px-4 py-3 font-black text-[var(--text)]">{index + 1}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--text)]">{row.nombre}</td>
                        <td className="px-4 py-3 font-black text-[var(--accent)]">{row.puntos}</td>
                        <td className="px-4 py-3">{row.campeonatos}</td>
                        <td className="px-4 py-3">{row.finales}</td>
                        <td className="px-4 py-3">{row.semifinales}</td>
                        <td className="px-4 py-3">{row.cuartos}</td>
                        <td className="px-4 py-3">{row.torneos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)]">
              No hay puntos cargados para esta categoria todavia. Los torneos genericos, sin bracket o no finalizados no suman.
            </section>
          )}
        </section>
      )}
    </main>
  );
}
