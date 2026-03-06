"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  areSamePlayers,
  buildPairName,
  isValidPlayerName,
  normalizePlayerName,
  type PairMode,
} from "@/lib/pair-utils";

type Estado = "CONFIGURACION" | "GRUPOS" | "RANKING" | "DESEMPATE" | "ELIMINATORIA" | "FINALIZADO";
type Metodo = "MONEDA" | "TIEBREAK";

const NAME_FORMAT_HELP = "Solo letras y espacios. Numero opcional al final (ej: Perez 2).";

type Pair = {
  id: string;
  jugador1: string;
  jugador2: string;
};

type EditTournamentFormProps = {
  torneoId: string;
  initialNombre: string;
  initialMetodo: Metodo;
  initialPairMode: PairMode;
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
  initialPairMode,
  initialParejas,
  estado,
}: EditTournamentFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [nombre, setNombre] = useState(initialNombre);
  const [metodo, setMetodo] = useState<Metodo>(initialMetodo);
  const [pairMode, setPairMode] = useState<PairMode>(initialPairMode);
  const [pendingGenericConfirm, setPendingGenericConfirm] = useState(false);
  const [parejas, setParejas] = useState<Pair[]>(initialParejas);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = estado === "FINALIZADO";
  const torneoHref = routeByEstado(torneoId, estado);
  const normalizedParejas = useMemo(
    () =>
      parejas.map((pair) => ({
        ...pair,
        jugador1: normalizePlayerName(pair.jugador1),
        jugador2: normalizePlayerName(pair.jugador2),
      })),
    [parejas],
  );
  const pairValidation = useMemo(
    () =>
      normalizedParejas.map((pair) => {
        const missingJugador1 = pair.jugador1.length === 0;
        const missingJugador2 = pair.jugador2.length === 0;
        const invalidJugador1 = !missingJugador1 && !isValidPlayerName(pair.jugador1);
        const invalidJugador2 = !missingJugador2 && !isValidPlayerName(pair.jugador2);
        const samePlayers = !missingJugador1 && !missingJugador2 && areSamePlayers(pair.jugador1, pair.jugador2);

        return {
          missingJugador1,
          missingJugador2,
          invalidJugador1,
          invalidJugador2,
          samePlayers,
          isValid: !missingJugador1 && !missingJugador2 && !invalidJugador1 && !invalidJugador2 && !samePlayers,
          preview: !missingJugador1 && !missingJugador2 ? buildPairName(pair.jugador1, pair.jugador2) : null,
        };
      }),
    [normalizedParejas],
  );
  const invalidCount = pairValidation.filter((pair) => !pair.isValid).length;
  const canSubmit =
    !readOnly &&
    !submitting &&
    !pendingGenericConfirm &&
    (pairMode === "GENERIC" || invalidCount === 0);

  function requestPairMode(next: PairMode) {
    if (readOnly || submitting || next === pairMode) {
      return;
    }

    if (next === "GENERIC" && pairMode === "CUSTOM") {
      setPendingGenericConfirm(true);
      return;
    }

    setPairMode(next);
    setPendingGenericConfirm(false);
    setError(null);
  }

  function confirmSwitchToGeneric() {
    setPairMode("GENERIC");
    setPendingGenericConfirm(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    if (readOnly) {
      return;
    }
    if (pendingGenericConfirm) {
      setError("Confirma o cancela el cambio a parejas genericas antes de guardar.");
      return;
    }
    if (pairMode === "CUSTOM" && invalidCount > 0) {
      setError("Completa Nombre 1 y Nombre 2 con formato valido en todas las parejas.");
      showToast({ message: "Revisa los nombres de las parejas personalizadas.", tone: "error" });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/torneo/${torneoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          metodoDesempate: metodo,
          pairMode,
          ...(pairMode === "CUSTOM"
            ? {
                parejas: normalizedParejas.map((pair) => ({
                  id: pair.id,
                  jugador1: pair.jugador1,
                  jugador2: pair.jugador2,
                })),
              }
            : {}),
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
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Modo de parejas</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={readOnly || submitting}
            onClick={() => requestPairMode("CUSTOM")}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              pairMode === "CUSTOM"
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            } disabled:opacity-70`}
          >
            <p className="text-sm font-bold">Personalizadas</p>
            <p className="mt-1 text-xs">Ingresar Nombre 1 y Nombre 2 por cada pareja.</p>
          </button>
          <button
            type="button"
            disabled={readOnly || submitting}
            onClick={() => requestPairMode("GENERIC")}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              pairMode === "GENERIC"
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
            } disabled:opacity-70`}
          >
            <p className="text-sm font-bold">Genericas</p>
            <p className="mt-1 text-xs">Guardar automaticamente como Pareja 1, Pareja 2, etc.</p>
          </button>
        </div>

        {pendingGenericConfirm ? (
          <div className="mt-4 rounded-xl border border-[var(--gold)]/70 bg-[var(--gold)]/15 p-3">
            <p className="text-sm font-semibold text-[var(--text)]">
              Vas a reemplazar los nombres actuales por parejas genericas al guardar.
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Esta accion pondra <span className="font-semibold">Pareja 1..N</span> y limpiara Nombre 1/Nombre 2.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingGenericConfirm(false)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSwitchToGeneric}
                className="rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#1f2937]"
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {pairMode === "CUSTOM" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Jugadores por pareja</p>
          <p className="mb-4 text-sm text-[var(--text-muted)]">Cada pareja debe tener exactamente dos nombres.</p>
          <div className="space-y-3">
            {parejas.map((pair, idx) => {
              const validation = pairValidation[idx];
              const showErrors = attemptedSubmit || pair.jugador1.length > 0 || pair.jugador2.length > 0;
              return (
                <div key={pair.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]">Pareja {idx + 1}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`pair-${pair.id}-jugador1`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]"
                      >
                        Nombre 1
                      </label>
                      <input
                        id={`pair-${pair.id}-jugador1`}
                        value={pair.jugador1}
                        required
                        disabled={readOnly || submitting}
                        onChange={(event) =>
                          setParejas((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, jugador1: event.target.value } : item,
                            ),
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none disabled:opacity-70 ${
                          showErrors && (validation?.missingJugador1 || validation?.invalidJugador1)
                            ? "border-[var(--red)] bg-[var(--red)]/10 focus:border-[var(--red)]"
                            : "border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)]"
                        }`}
                      />
                      {showErrors && validation?.missingJugador1 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--red)]">Completa Nombre 1.</p>
                      ) : null}
                      {showErrors && validation?.invalidJugador1 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--red)]">{NAME_FORMAT_HELP}</p>
                      ) : null}
                    </div>
                    <div>
                      <label
                        htmlFor={`pair-${pair.id}-jugador2`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]"
                      >
                        Nombre 2
                      </label>
                      <input
                        id={`pair-${pair.id}-jugador2`}
                        value={pair.jugador2}
                        required
                        disabled={readOnly || submitting}
                        onChange={(event) =>
                          setParejas((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, jugador2: event.target.value } : item,
                            ),
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none disabled:opacity-70 ${
                          showErrors && (validation?.missingJugador2 || validation?.invalidJugador2 || validation?.samePlayers)
                            ? "border-[var(--red)] bg-[var(--red)]/10 focus:border-[var(--red)]"
                            : "border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)]"
                        }`}
                      />
                      {showErrors && validation?.missingJugador2 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--red)]">Completa Nombre 2.</p>
                      ) : null}
                      {showErrors && validation?.invalidJugador2 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--red)]">{NAME_FORMAT_HELP}</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Nombre de pareja:{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {validation?.preview ?? "Nombre 1 - Nombre 2"}
                    </span>
                  </p>
                  {showErrors && validation?.samePlayers ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--red)]">
                      Nombre 1 y Nombre 2 no pueden ser iguales.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!readOnly && invalidCount > 0 ? (
            <p className="mt-3 text-sm font-semibold text-[var(--red)]">
              Hay {invalidCount} pareja{invalidCount === 1 ? "" : "s"} incompleta{invalidCount === 1 ? "" : "s"} o
              invalida{invalidCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--text-muted)]">
            Al guardar se reemplazaran por <span className="font-semibold text-[var(--text)]">Pareja 1</span>,{" "}
            <span className="font-semibold text-[var(--text)]">Pareja 2</span> ...{" "}
            <span className="font-semibold text-[var(--text)]">Pareja {parejas.length}</span>.
          </p>
        </section>
      )}

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
            disabled={!canSubmit}
            className="h-11 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
