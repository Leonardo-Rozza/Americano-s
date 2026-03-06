"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type Estado = "CONFIGURACION" | "GRUPOS" | "RANKING" | "DESEMPATE" | "ELIMINATORIA" | "FINALIZADO";
type Metodo = "MONEDA" | "TIEBREAK";

type Pair = {
  id: string;
  nombre: string;
};

type EditTournamentFormProps = {
  torneoId: string;
  initialNombre: string;
  initialMetodo: Metodo;
  initialParejas: Pair[];
  estado: Estado;
};

function routeByEstado(torneoId: string, estado: Estado) {
  if (estado === "RANKING") return `/torneo/${torneoId}/ranking`;
  if (estado === "DESEMPATE") return `/torneo/${torneoId}/desempate`;
  if (estado === "ELIMINATORIA" || estado === "FINALIZADO") return `/torneo/${torneoId}/bracket`;
  return `/torneo/${torneoId}/grupos`;
}

export function EditTournamentForm({
  torneoId,
  initialNombre,
  initialMetodo,
  initialParejas,
  estado,
}: EditTournamentFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [nombre, setNombre] = useState(initialNombre);
  const [metodo, setMetodo] = useState<Metodo>(initialMetodo);
  const [parejas, setParejas] = useState<Pair[]>(initialParejas);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = estado === "FINALIZADO";
  const torneoHref = routeByEstado(torneoId, estado);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/torneo/${torneoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          metodoDesempate: metodo,
          parejas,
        }),
      });
      const payload = (await response.json()) as
        | { success: true }
        | { success: false; error: string };

      if (!payload.success) {
        setError(payload.error);
        showToast({ message: payload.error, tone: "error" });
        return;
      }

      showToast({ message: "Torneo actualizado.", tone: "success" });
      router.push(torneoHref);
      router.refresh();
    } catch {
      setError("No se pudo actualizar el torneo.");
      showToast({ message: "No se pudo actualizar el torneo.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Nombre del torneo
        </label>
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          required
          disabled={readOnly || submitting}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-70"
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Metodo de desempate
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={readOnly || submitting}
            onClick={() => setMetodo("MONEDA")}
            className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
              metodo === "MONEDA"
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            } disabled:opacity-70`}
          >
            🪙 Moneda
          </button>
          <button
            type="button"
            disabled={readOnly || submitting}
            onClick={() => setMetodo("TIEBREAK")}
            className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
              metodo === "TIEBREAK"
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            } disabled:opacity-70`}
          >
            🎾 Tie-break
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Nombres de parejas</p>
        <div className="grid gap-2 md:grid-cols-2">
          {parejas.map((pair, idx) => (
            <input
              key={pair.id}
              value={pair.nombre}
              required
              disabled={readOnly || submitting}
              onChange={(event) =>
                setParejas((current) =>
                  current.map((item, i) =>
                    i === idx ? { ...item, nombre: event.target.value } : item,
                  ),
                )
              }
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-70"
            />
          ))}
        </div>
      </section>

      {readOnly ? (
        <p className="text-sm font-semibold text-[var(--text-muted)]">
          El torneo esta finalizado. Solo se permite visualizar esta configuracion.
        </p>
      ) : null}

      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={torneoHref}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-bold text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          Volver al torneo
        </Link>
        {!readOnly ? (
          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
