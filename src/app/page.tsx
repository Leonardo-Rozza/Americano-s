import Link from "next/link";
import { db } from "@/lib/db";
import { DeleteTorneoButton } from "@/components/tournament/DeleteTorneoButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const torneos = await db.torneo.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          parejas: true,
          grupos: true,
        },
      },
      bracket: true,
    },
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Americano&apos;s
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text)] md:text-5xl">
            Torneos
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Gestiona fases de grupos, ranking, desempates y cuadro eliminatorio.
          </p>
        </div>
        <Link
          href="/torneo/nuevo"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:brightness-110"
        >
          Crear Torneo
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {torneos.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)] md:col-span-2 xl:col-span-3">
            No hay torneos creados.
          </div>
        ) : null}

        {torneos.map((torneo) => (
          <article
            key={torneo.id}
            className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]/70 hover:bg-[var(--surface-2)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link href={`/torneo/${torneo.id}/grupos`} className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-extrabold text-[var(--text)]">{torneo.nombre}</h2>
              </Link>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs font-bold uppercase text-[var(--text-dim)]">
                  {torneo.estado}
                </span>
                <DeleteTorneoButton torneoId={torneo.id} torneoNombre={torneo.nombre} />
              </div>
            </div>
            <div className="space-y-1 text-sm text-[var(--text-muted)]">
              <p>{torneo._count.parejas} parejas</p>
              <p>{torneo._count.grupos} grupos</p>
              <p>{torneo.bracket ? `Cuadro de ${torneo.bracket.tamano}` : "Sin bracket generado"}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
