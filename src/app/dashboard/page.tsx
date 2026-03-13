import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getTournamentRouteByState } from "@/lib/tournament-routing";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const authUser = await requirePageAuth();

  const [totalTorneos, lastTorneo] = await Promise.all([
    db.torneo.count({
      where: { userId: authUser.userId },
    }),
    db.torneo.findFirst({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 md:px-8">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Dashboard</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">
              Hola, {authUser.username}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Gestioná tus torneos privados y seguí el estado de cada uno.
            </p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:col-span-1">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">Torneos</p>
          <p className="mt-2 text-4xl font-black text-[var(--accent)]">{totalTorneos}</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">Último torneo</p>
          {lastTorneo ? (
            <div className="mt-2">
              <p className="text-xl font-extrabold text-[var(--text)]">{lastTorneo.nombre}</p>
              <p className="text-sm text-[var(--text-muted)]">Estado: {lastTorneo.estado}</p>
              <Link
                href={getTournamentRouteByState(lastTorneo.id, lastTorneo.estado)}
                className="mt-3 inline-flex h-10 items-center rounded-lg border border-[var(--accent)] bg-[var(--accent)]/15 px-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text)] transition hover:bg-[var(--accent)]/25"
              >
                Continuar torneo
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Todavía no creaste torneos.</p>
          )}
        </article>
      </section>

      <section className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/torneos"
          className="inline-flex h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          Ver mis torneos
        </Link>
        <Link
          href="/torneos/create"
          className="btn-primary inline-flex h-11 items-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110"
        >
          Crear torneo
        </Link>
      </section>
    </main>
  );
}
