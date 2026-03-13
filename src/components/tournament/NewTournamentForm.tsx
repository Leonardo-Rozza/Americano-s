'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { authFetch } from '@/lib/auth/auth-fetch';
import { listPadelCategories, type PadelCategory } from '@/lib/padel-category';
import {
  buildPairValidations,
  NAME_FORMAT_HELP,
  normalizePairInputs,
} from '@/lib/pair-input';
import {
  type PairMode,
} from '@/lib/pair-utils';
import { getBracketSize } from '@/lib/tournament-engine/bracket';
import { calcGroups, listGroupConfigs } from '@/lib/tournament-engine/groups';
import type { GrupoConfig } from '@/lib/tournament-engine/types';

const MIN_PAREJAS = 6;
const MAX_PAREJAS = 30;
const LARGO_QUALIFIERS_BY_GROUP_SIZE = { '3': 2, '4': 3 } as const;

type PadelFormat = 'AMERICANO' | 'LARGO';

type PairDraft = {
  jugador1: string;
  jugador2: string;
};

const FORMAT_OPTIONS: Array<{
  id: PadelFormat;
  title: string;
  description: string;
}> = [
  {
    id: 'AMERICANO',
    title: 'Americano',
    description: 'Ideal para una jornada intensa con grupos y definicion rapida.',
  },
  {
    id: 'LARGO',
    title: 'Largo',
    description: 'Ideal para torneos con continuidad, zonas y eliminatoria progresiva.',
  },
];

function createEmptyPairs(total: number) {
  return Array.from({ length: total }, () => ({ jugador1: '', jugador2: '' }));
}

function sameFormat(a: GrupoConfig, b: GrupoConfig) {
  return a.g3 === b.g3 && a.g4 === b.g4;
}

function formatLabel(config: GrupoConfig) {
  return `${config.g3}x3 + ${config.g4}x4`;
}

function pickPreferredGroupConfig(options: GrupoConfig[], formato: PadelFormat) {
  if (options.length === 0) {
    return null;
  }
  if (formato === 'LARGO') {
    return options[options.length - 1];
  }
  return options[0];
}

export function NewTournamentForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const categoryOptions = listPadelCategories();

  const [formato, setFormato] = useState<PadelFormat>('AMERICANO');
  const [nombre, setNombre] = useState('Americano');
  const [categoriaPadel, setCategoriaPadel] = useState<PadelCategory | ''>('');
  const [numParejas, setNumParejas] = useState(12);
  const [groupConfig, setGroupConfig] = useState<GrupoConfig>(() => calcGroups(12));
  const [pairMode, setPairMode] = useState<PairMode>('CUSTOM');
  const [parejas, setParejas] = useState<PairDraft[]>(createEmptyPairs(12));
  const [superTiebreakThirdSet, setSuperTiebreakThirdSet] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupOptions = useMemo(() => listGroupConfigs(numParejas), [numParejas]);
  const displayedGroupOptions = useMemo(() => {
    if (formato !== 'LARGO') {
      return groupOptions;
    }
    return [...groupOptions].sort((a, b) => b.g4 - a.g4 || a.g3 - b.g3);
  }, [formato, groupOptions]);

  const preview = useMemo(() => {
    if (formato === 'AMERICANO') {
      const bracketSize = getBracketSize(numParejas);
      const byes = bracketSize - numParejas;
      return { ...groupConfig, qualifiers: numParejas, bracketSize, byes };
    }

    const qualifiers =
      groupConfig.g3 * LARGO_QUALIFIERS_BY_GROUP_SIZE['3'] +
      groupConfig.g4 * LARGO_QUALIFIERS_BY_GROUP_SIZE['4'];
    const bracketSize = getBracketSize(qualifiers);
    const byes = bracketSize - qualifiers;
    return { ...groupConfig, qualifiers, bracketSize, byes };
  }, [formato, groupConfig, numParejas]);

  const normalizedParejas = useMemo(() => normalizePairInputs(parejas), [parejas]);
  const pairValidation = useMemo(() => buildPairValidations(normalizedParejas), [normalizedParejas]);

  const invalidCount = pairValidation.filter((pair) => !pair.isValid).length;
  const canSubmit = !submitting && categoriaPadel !== '' && (pairMode === 'GENERIC' || invalidCount === 0);

  function selectFormat(next: PadelFormat) {
    setFormato(next);
    const nextOptions = listGroupConfigs(numParejas);
    const preferred = pickPreferredGroupConfig(nextOptions, next);
    if (preferred) {
      setGroupConfig((current) =>
        next === 'LARGO'
          ? preferred
          : nextOptions.some((option) => sameFormat(option, current))
            ? current
            : preferred,
      );
    }

    setNombre((current) => {
      const trimmed = current.trim();
      if (trimmed.length === 0 || trimmed === 'Americano' || trimmed === 'Largo') {
        return next === 'AMERICANO' ? 'Americano' : 'Largo';
      }
      return current;
    });
  }

  function updateCount(next: number) {
    const value = Math.max(MIN_PAREJAS, Math.min(MAX_PAREJAS, next));
    setNumParejas(value);
    const nextOptions = listGroupConfigs(value);
    const preferred = pickPreferredGroupConfig(nextOptions, formato);
    if (nextOptions.length > 0) {
      setGroupConfig((current) =>
        formato === 'LARGO'
          ? (preferred ?? nextOptions[0])
          : nextOptions.some((option) => sameFormat(option, current))
            ? current
            : (preferred ?? nextOptions[0]),
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
      setError('Revisa los nombres: cada jugador debe ser unico y todas las parejas deben tener formato valido.');
      showToast({ message: 'Hay nombres repetidos o con formato invalido en las parejas.', tone: 'error' });
      return;
    }

    if (!categoriaPadel) {
      setSubmitting(false);
      setError('Elegi la categoria del torneo antes de continuar.');
      showToast({ message: 'Elegi la categoria del torneo.', tone: 'error' });
      return;
    }

    const body = {
      nombre: nombre.trim(),
      deporte: 'PADEL' as const,
      formato,
      categoriaPadel,
      numParejas,
      pairMode,
      ...(pairMode === 'CUSTOM'
        ? {
            parejas: normalizedParejas,
          }
        : {}),
      formatoGrupos: groupConfig,
      ...(formato === 'LARGO'
        ? {
            config: {
              superTiebreakTercerSet: superTiebreakThirdSet,
              qualifiersByGroupSize: LARGO_QUALIFIERS_BY_GROUP_SIZE,
            },
          }
        : {}),
    };

    try {
      const response = await authFetch('/api/torneo', {
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-extrabold text-[var(--text)]">Formato del torneo</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Esta pantalla crea torneos de padel. Elegi entre Americano o Largo.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((option) => {
            const active = option.id === formato;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectFormat(option.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                <p className="text-base font-bold">{option.title}</p>
                <p className="mt-1 text-sm">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Nombre del torneo
            </label>
            <input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Que categoria queres hacer
            </label>
            <select
              value={categoriaPadel}
              onChange={(event) => setCategoriaPadel(event.target.value as PadelCategory | '')}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">Elegi una categoria</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Cantidad de parejas</p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => updateCount(numParejas - 1)}
                className="h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xl font-bold text-[var(--text)] transition hover:border-[var(--accent)]"
              >
                -
              </button>
              <span className="min-w-20 text-center font-mono text-4xl font-black text-[var(--accent)]">{numParejas}</span>
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
              className="mt-3 w-full accent-[var(--accent)]"
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Formato de zonas</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {displayedGroupOptions.map((option) => {
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
                    {option.g4 > 0
                      ? formato === 'AMERICANO'
                        ? 'Incluye grupos de 4 con segunda ronda.'
                        : 'Incluye zonas de 4 todos contra todos.'
                      : 'Solo zonas de 3.'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">Zonas</p>
          <p className="mt-1 text-2xl font-black text-[var(--text)]">
            {preview.g3}x3 <span className="text-[var(--text-dim)]">+ </span>
            {preview.g4}x4
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">
            {formato === 'AMERICANO' ? 'Cuadro' : 'Clasifican'}
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--accent)]">
            {formato === 'AMERICANO' ? preview.bracketSize : preview.qualifiers}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">BYEs</p>
          <p className="mt-1 text-2xl font-black text-[var(--purple)]">{preview.byes}</p>
        </div>
        {formato === 'LARGO' ? (
          <p className="sm:col-span-3 text-xs text-[var(--text-muted)]">
            En zonas de 4 clasifican 3 parejas; en zonas de 3 clasifican 2.
          </p>
        ) : null}
      </section>

      {formato === 'LARGO' ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Configuracion de largo
          </p>
          <button
            type="button"
            onClick={() => setSuperTiebreakThirdSet((current) => !current)}
            className={`rounded-lg border px-3 py-2 text-left ${
              superTiebreakThirdSet
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            <p className="text-sm font-semibold">Super tie-break en set final</p>
            <p className="text-xs">{superTiebreakThirdSet ? 'Habilitado' : 'Set completo'}</p>
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Modo de parejas</p>
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
            Completa Nombre 1 y Nombre 2 para cada pareja. Un mismo jugador no puede repetirse en otra pareja.
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
                            current.map((item, i) => (i === idx ? { ...item, jugador1: event.target.value } : item)),
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none ${
                          showErrors &&
                          (validation?.missingJugador1 || validation?.invalidJugador1 || validation?.duplicateJugador1)
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
                      {showErrors && validation?.duplicateJugador1 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--red)]">
                          Este jugador ya fue cargado en otra pareja.
                        </p>
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
                            current.map((item, i) => (i === idx ? { ...item, jugador2: event.target.value } : item)),
                          )
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none ${
                          showErrors &&
                          (
                            validation?.missingJugador2 ||
                            validation?.invalidJugador2 ||
                            validation?.samePlayers ||
                            validation?.duplicateJugador2
                          )
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
                      {showErrors && validation?.duplicateJugador2 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--red)]">
                          Este jugador ya fue cargado en otra pareja.
                        </p>
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
              Hay {invalidCount} pareja{invalidCount === 1 ? '' : 's'} incompleta
              {invalidCount === 1 ? '' : 's'}, invalida{invalidCount === 1 ? '' : 's'} o repetida
              {invalidCount === 1 ? '' : 's'}.
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

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary h-12 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-6 text-base font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creando...' : 'Crear Torneo'}
        </button>
      </div>
    </form>
  );
}
