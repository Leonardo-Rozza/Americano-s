import Link from "next/link";
import { db } from "@/lib/db";
import { DeleteTorneoButton } from "@/components/tournament/DeleteTorneoButton";
import { requirePageAuth } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";

function routeByEstado(torneoId: string, estado: string) {
  if (estado === "RANKING") return `/torneo/${torneoId}/ranking`;
  if (estado === "DESEMPATE") return `/torneo/${torneoId}/desempate`;
  if (estado === "ELIMINATORIA" || estado === "FINALIZADO") return `/torneo/${torneoId}/bracket`;
  return `/torneo/${torneoId}/grupos`;
}

export default async function TorneosPage() {
  const authUser = await requirePageAuth();

  const torneos = await db.torneo.findMany({
    where: { userId: authUser.userId },
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
            Mis torneos
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Solo ves los torneos asociados a tu cuenta.
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
            href="/torneos/create"
            className="btn-primary inline-flex h-11 items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:brightness-110"
          >
            Crear Torneo
          </Link>
        </div>
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
              <Link href={routeByEstado(torneo.id, torneo.estado)} className="min-w-0 flex-1">
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={routeByEstado(torneo.id, torneo.estado)}
                className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                Ver
              </Link>
              {torneo.estado !== "FINALIZADO" ? (
                <Link
                  href={`/torneo/${torneo.id}/editar`}
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                >
                  Editar
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
