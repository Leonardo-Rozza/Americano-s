import Link from "next/link";
import { NewTournamentForm } from "@/components/tournament/NewTournamentForm";

export default function NewTorneoPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 md:px-8">
      <header className="mb-8">
        <Link
          href="/torneos"
          className="text-sm font-semibold text-[var(--text-dim)] transition hover:text-[var(--text)]"
        >
          ← Volver
        </Link>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-[var(--text)]">Nuevo Torneo</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Configura cantidad de parejas, método de desempate y generación de grupos.
        </p>
      </header>

      <NewTournamentForm />
    </main>
  );
}
