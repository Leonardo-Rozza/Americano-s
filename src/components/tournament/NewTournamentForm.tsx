'use client';

import { useToast } from '@/components/ui/ToastProvider';
import { getBracketSize } from '@/lib/tournament-engine/bracket';
import { calcGroups, listGroupConfigs } from '@/lib/tournament-engine/groups';
import {
  areSamePlayers,
  buildPairName,
  isValidPlayerName,
  normalizePlayerName,
  type PairMode,
} from '@/lib/pair-utils';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const MIN_PAREJAS = 6;
const MAX_PAREJAS = 30;
const NAME_FORMAT_HELP = 'Solo letras y espacios. Numero opcional al final (ej: Perez 2).';

type PairDraft = {
  jugador1: string;
  jugador2: string;
};

function createEmptyPairs(total: number) {
  return Array.from({ length: total }, () => ({ jugador1: '', jugador2: '' }));
}

function sameFormat(a: { g3: number; g4: number }, b: { g3: number; g4: number }) {
  return a.g3 === b.g3 && a.g4 === b.g4;
}

function formatLabel(config: { g3: number; g4: number }) {
  return `${config.g3}x3 + ${config.g4}x4`;
}

export function NewTournamentForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [nombre, setNombre] = useState('Americano');
  const [numParejas, setNumParejas] = useState(12);
  const [groupConfig, setGroupConfig] = useState(() => calcGroups(12));
  const [metodo, setMetodo] = useState<'MONEDA' | 'TIEBREAK'>('MONEDA');
  const [pairMode, setPairMode] = useState<PairMode>('CUSTOM');
  const [parejas, setParejas] = useState<PairDraft[]>(createEmptyPairs(12));
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = useMemo(() => listGroupConfigs(numParejas), [numParejas]);

  const preview = useMemo(() => {
    const bracketSize = getBracketSize(numParejas);
    const byes = bracketSize - numParejas;
    return { ...groupConfig, bracketSize, byes };
  }, [groupConfig, numParejas]);

  const normalizedParejas = useMemo(
    () =>
      parejas.map((pair) => ({
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
  const canSubmit = !submitting && (pairMode === 'GENERIC' || invalidCount === 0);

  function updateCount(next: number) {
    const value = Math.max(MIN_PAREJAS, Math.min(MAX_PAREJAS, next));
    setNumParejas(value);
    const nextOptions = listGroupConfigs(value);
    if (nextOptions.length > 0) {
      setGroupConfig((current) =>
        nextOptions.some((option) => sameFormat(option, current)) ? current : nextOptions[0],
      );
    }
    setParejas((current) =>
      Array.from({ length: value }, (_, idx) => current[idx] ?? { jugador1: '', jugador2: '' }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setSubmitting(true);
    setError(null);

    if (pairMode === 'CUSTOM' && invalidCount > 0) {
      setSubmitting(false);
      setError('Completa Nombre 1 y Nombre 2 con formato valido en todas las parejas.');
      showToast({ message: 'Revisa los nombres de las parejas personalizadas.', tone: 'error' });
      return;
    }

    const body = {
      nombre: nombre.trim(),
      numParejas,
      metodoDesempate: metodo,
      pairMode,
      ...(pairMode === 'CUSTOM'
        ? {
            parejas: normalizedParejas,
          }
        : {}),
      formatoGrupos: groupConfig,
    };

    try {
      const response = await fetch('/api/torneo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | { success: true; data: { id: string } }
        | { success: false; error: string };

      if (!payload.success) {
        setError(payload.error);
        showToast({ message: payload.error, tone: 'error' });
        return;
      }

      router.push(`/torneo/${payload.data.id}/grupos`);
    } catch {
      setError('No se pudo crear el torneo.');
      showToast({ message: 'No se pudo crear el torneo.', tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-(--border) bg-(--surface) p-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-(--text-dim)">
          Nombre del torneo
        </label>
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          required
          className="w-full rounded-xl border border-(--border) bg-(--surface-2) px-3 py-2 text-(--text) outline-none focus:border-(--accent)"
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Cantidad de parejas
        </p>
        <div className="mt-4 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => updateCount(numParejas - 1)}
            className="h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xl font-bold text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            -
          </button>
          <span className="min-w-24 text-center font-mono text-5xl font-black text-[var(--accent)]">
            {numParejas}
          </span>
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
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  <p className="text-sm font-bold">{formatLabel(option)}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {option.g4 > 0 ? 'Incluye grupos de 4 (con Ronda 2).' : 'Solo grupos de 3.'}
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
            onClick={() => setMetodo('MONEDA')}
            className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
              metodo === 'MONEDA'
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            🪙 Moneda
          </button>
          <button
            type="button"
            onClick={() => setMetodo('TIEBREAK')}
            className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
              metodo === 'TIEBREAK'
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            🎾 Tie-break
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Modo de parejas
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPairMode('CUSTOM')}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              pairMode === 'CUSTOM'
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            <p className="text-sm font-bold">Personalizadas</p>
            <p className="mt-1 text-xs">Ingresar Nombre 1 y Nombre 2 por cada pareja.</p>
          </button>
          <button
            type="button"
            onClick={() => setPairMode('GENERIC')}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              pairMode === 'GENERIC'
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            <p className="text-sm font-bold">Genericas</p>
            <p className="mt-1 text-xs">Guardar automaticamente como Pareja 1, Pareja 2, etc.</p>
          </button>
        </div>
      </section>

      {pairMode === 'CUSTOM' ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Jugadores por pareja
          </p>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Completa Nombre 1 y Nombre 2 para cada pareja.
          </p>

          <div className="space-y-3">
            {parejas.map((pair, idx) => {
              const validation = pairValidation[idx];
              const showErrors = attemptedSubmit || pair.jugador1.length > 0 || pair.jugador2.length > 0;
              return (
                <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                    Pareja {idx + 1}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`new-pair-${idx}-jugador1`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]"
                      >
                        Nombre 1
                      </label>
                      <input
                        id={`new-pair-${idx}-jugador1`}
                        value={pair.jugador1}
                        required
                        onChange={(event) =>
                          setParejas((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, jugador1: event.target.value } : item,
                            ),
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none ${
                          showErrors && (validation?.missingJugador1 || validation?.invalidJugador1)
                            ? 'border-[var(--red)] bg-[var(--red)]/10 focus:border-[var(--red)]'
                            : 'border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)]'
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
                        htmlFor={`new-pair-${idx}-jugador2`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]"
                      >
                        Nombre 2
                      </label>
                      <input
                        id={`new-pair-${idx}-jugador2`}
                        value={pair.jugador2}
                        required
                        onChange={(event) =>
                          setParejas((current) =>
                            current.map((item, i) =>
                              i === idx ? { ...item, jugador2: event.target.value } : item,
                            ),
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none ${
                          showErrors && (validation?.missingJugador2 || validation?.invalidJugador2 || validation?.samePlayers)
                            ? 'border-[var(--red)] bg-[var(--red)]/10 focus:border-[var(--red)]'
                            : 'border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)]'
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
                    Nombre de pareja:{' '}
                    <span className="font-semibold text-[var(--text)]">
                      {validation?.preview ?? 'Nombre 1 - Nombre 2'}
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

          {invalidCount > 0 ? (
            <p className="mt-3 text-sm font-semibold text-[var(--red)]">
              Hay {invalidCount} pareja{invalidCount === 1 ? '' : 's'} incompleta{invalidCount === 1 ? '' : 's'} o
              invalida{invalidCount === 1 ? '' : 's'}.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--text-muted)]">
            Se guardaran automaticamente como <span className="font-semibold text-[var(--text)]">Pareja 1</span>,{' '}
            <span className="font-semibold text-[var(--text)]">Pareja 2</span> ...{' '}
            <span className="font-semibold text-[var(--text)]">Pareja {numParejas}</span>.
          </p>
        </section>
      )}

      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] text-base font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Creando…' : 'Crear Torneo'}
      </button>
    </form>
  );
}
