"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calcGroups, listGroupConfigs } from "@/lib/tournament-engine/groups";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import { useToast } from "@/components/ui/ToastProvider";

const MIN_PAREJAS = 6;
const MAX_PAREJAS = 30;

function createDefaultNames(total: number) {
  return Array.from({ length: total }, (_, idx) => `Pareja ${idx + 1}`);
}

function sameFormat(
  a: { g3: number; g4: number },
  b: { g3: number; g4: number },
) {
  return a.g3 === b.g3 && a.g4 === b.g4;
}

function formatLabel(config: { g3: number; g4: number }) {
  return `${config.g3}x3 + ${config.g4}x4`;
}

export function NewTournamentForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [nombre, setNombre] = useState("Americano");
  const [numParejas, setNumParejas] = useState(12);
  const [groupConfig, setGroupConfig] = useState(() => calcGroups(12));
  const [metodo, setMetodo] = useState<"MONEDA" | "TIEBREAK">("MONEDA");
  const [useNames, setUseNames] = useState(false);
  const [nombres, setNombres] = useState<string[]>(createDefaultNames(12));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = useMemo(() => listGroupConfigs(numParejas), [numParejas]);

  const preview = useMemo(() => {
    const bracketSize = getBracketSize(numParejas);
    const byes = bracketSize - numParejas;
    return { ...groupConfig, bracketSize, byes };
  }, [groupConfig, numParejas]);

  function updateCount(next: number) {
    const value = Math.max(MIN_PAREJAS, Math.min(MAX_PAREJAS, next));
    setNumParejas(value);
    const nextOptions = listGroupConfigs(value);
    if (nextOptions.length > 0) {
      setGroupConfig((current) =>
        nextOptions.some((option) => sameFormat(option, current)) ? current : nextOptions[0],
      );
    }
    setNombres((current) =>
      Array.from({ length: value }, (_, idx) => current[idx] ?? `Pareja ${idx + 1}`),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      nombre,
      numParejas,
      metodoDesempate: metodo,
      useNames,
      nombres: useNames ? nombres : undefined,
      formatoGrupos: groupConfig,
    };

    try {
      const response = await fetch("/api/torneo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: string };

      if (!payload.success) {
        setError(payload.error);
        showToast({ message: payload.error, tone: "error" });
        return;
      }

      router.push(`/torneo/${payload.data.id}/grupos`);
    } catch {
      setError("No se pudo crear el torneo.");
      showToast({ message: "No se pudo crear el torneo.", tone: "error" });
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
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Cantidad de parejas</p>
        <div className="mt-4 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => updateCount(numParejas - 1)}
            className="h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xl font-bold text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            -
          </button>
          <span className="min-w-24 text-center font-mono text-5xl font-black text-[var(--accent)]">{numParejas}</span>
          <button
            type="button"
            onClick={() => updateCount(numParejas + 1)}
            className="h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xl font-bold text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={MIN_PAREJAS}
          max={MAX_PAREJAS}
          value={numParejas}
          onChange={(event) => updateCount(Number(event.target.value))}
          className="mt-4 w-full accent-[var(--accent)]"
        />

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Formato de grupos
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {groupOptions.map((option) => {
              const active = sameFormat(option, groupConfig);
              return (
                <button
                  key={`${option.g3}-${option.g4}`}
                  type="button"
                  onClick={() => setGroupConfig(option)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                  }`}
                >
                  <p className="text-sm font-bold">{formatLabel(option)}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {option.g4 > 0 ? "Incluye grupos de 4 (con Ronda 2)." : "Solo grupos de 3."}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">Grupos</p>
          <p className="mt-1 text-2xl font-black text-[var(--text)]">
            {preview.g3}x3 <span className="text-[var(--text-dim)]">+ </span>
            {preview.g4}x4
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">Cuadro</p>
          <p className="mt-1 text-2xl font-black text-[var(--accent)]">{preview.bracketSize}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">BYEs</p>
          <p className="mt-1 text-2xl font-black text-[var(--purple)]">{preview.byes}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Metodo de desempate
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMetodo("MONEDA")}
            className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
              metodo === "MONEDA"
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            }`}
          >
            🪙 Moneda
          </button>
          <button
            type="button"
            onClick={() => setMetodo("TIEBREAK")}
            className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
              metodo === "TIEBREAK"
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            }`}
          >
            🎾 Tie-break
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Nombres de parejas</p>
          <button
            type="button"
            onClick={() => setUseNames((value) => !value)}
            className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
              useNames
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            }`}
          >
            {useNames ? "Personalizados" : "Genericos"}
          </button>
        </div>

        {useNames ? (
          <div className="grid gap-2 md:grid-cols-2">
            {nombres.map((item, idx) => (
              <input
                key={idx}
                value={item}
                required
                onChange={(event) =>
                  setNombres((current) =>
                    current.map((name, i) => (i === idx ? event.target.value : name)),
                  )
                }
                placeholder={`Pareja ${idx + 1}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Se usarán nombres automáticos (Pareja 1, Pareja 2...).</p>
        )}
      </section>

      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] text-base font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Creando…" : "Crear Torneo"}
      </button>
    </form>
  );
}
