"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Estado = "CONFIGURACION" | "GRUPOS" | "RANKING" | "DESEMPATE" | "ELIMINATORIA" | "FINALIZADO";

type TorneoHeaderProps = {
  torneoId: string;
  nombre: string;
  fechaISO: string;
  parejas: number;
  estado: Estado;
};

type PhaseConfig = {
  key: "grupos" | "ranking" | "desempate" | "bracket";
  label: string;
  path: string;
  states: Estado[];
};

const PHASES: PhaseConfig[] = [
  { key: "grupos", label: "Grupos", path: "grupos", states: ["GRUPOS", "RANKING", "DESEMPATE", "ELIMINATORIA", "FINALIZADO"] },
  { key: "ranking", label: "Ranking", path: "ranking", states: ["RANKING", "DESEMPATE", "ELIMINATORIA", "FINALIZADO"] },
  { key: "desempate", label: "Desempate", path: "desempate", states: ["DESEMPATE", "ELIMINATORIA", "FINALIZADO"] },
  { key: "bracket", label: "Bracket", path: "bracket", states: ["ELIMINATORIA", "FINALIZADO"] },
];

function getCurrentPhase(pathname: string) {
  if (pathname.includes("/bracket")) return "bracket";
  if (pathname.includes("/desempate")) return "desempate";
  if (pathname.includes("/ranking")) return "ranking";
  return "grupos";
}

export function TorneoHeader({ torneoId, nombre, fechaISO, parejas, estado }: TorneoHeaderProps) {
  const pathname = usePathname();
  const current = getCurrentPhase(pathname);

  return (
    <header className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Torneo</p>
          <h1 className="text-2xl font-extrabold text-[var(--text)] md:text-3xl">{nombre}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Dashboard
          </Link>
          <Link
            href="/torneos"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Mis torneos
          </Link>
          {estado === "FINALIZADO" ? (
            <Link
              href="/torneos/create"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-3 text-sm font-bold text-[#1f2937] transition hover:brightness-110"
            >
              Crear otro torneo
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid gap-2 text-sm text-[var(--text-muted)] md:grid-cols-3">
        <p>
          Fecha:{" "}
          <span className="font-semibold text-[var(--text)]">
            {new Date(fechaISO).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </p>
        <p>
          Parejas: <span className="font-semibold text-[var(--text)]">{parejas}</span>
        </p>
        <p>
          Estado: <span className="font-semibold text-[var(--accent)]">{estado}</span>
        </p>
      </div>

      <nav className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-2">
          {PHASES.map((phase, idx) => {
            const href = `/torneo/${torneoId}/${phase.path}`;
            const active = phase.key === current;
            const unlocked = phase.states.includes(estado);
            return (
              <li key={phase.key} className="flex items-center gap-2">
                <Link
                  href={href}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text)]"
                      : unlocked
                        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
                        : "border-[var(--border)]/60 bg-transparent text-[var(--text-dim)]"
                  }`}
                >
                  {phase.label}
                </Link>
                {idx < PHASES.length - 1 ? <span className="text-[var(--text-dim)]">→</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
