'use client';

import { useToast } from '@/components/ui/ToastProvider';
import { authFetch } from '@/lib/auth/auth-fetch';
import {
  isFormatSupportedForSport,
  isTournamentCombinationEnabled,
  TOURNAMENT_FORMAT_OPTIONS,
  TOURNAMENT_SPORT_OPTIONS,
} from '@/lib/tournament-catalog';
import {
  areSamePlayers,
  buildPairName,
  isValidPlayerName,
  normalizePlayerName,
  type PairMode,
} from '@/lib/pair-utils';
import { getBracketSize } from '@/lib/tournament-engine/bracket';
import { calcGroups, listGroupConfigs } from '@/lib/tournament-engine/groups';
import type { TournamentFormat, TournamentSport } from '@/lib/tournament-engine/types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const MIN_PAREJAS = 6;
const MAX_PAREJAS = 30;
const NAME_FORMAT_HELP = 'Solo letras y espacios. Numero opcional al final (ej: Perez 2).';
const STEP_LABELS = ['Deporte', 'Formato', 'Configuracion'] as const;
const LARGO_QUALIFIERS_BY_GROUP_SIZE = { '3': 2, '4': 3 } as const;

type PairDraft = {
  jugador1: string;
  jugador2: string;
};

type WizardStep = 1 | 2 | 3;
type TennisMode = 'SINGLES' | 'DOBLES';

function createEmptyPairs(total: number) {
  return Array.from({ length: total }, () => ({ jugador1: '', jugador2: '' }));
}

function sameFormat(a: { g3: number; g4: number }, b: { g3: number; g4: number }) {
  return a.g3 === b.g3 && a.g4 === b.g4;
}

function formatLabel(config: { g3: number; g4: number }) {
  return `${config.g3}x3 + ${config.g4}x4`;
}

function pickPreferredGroupConfig(
  options: Array<{ g3: number; g4: number }>,
  formato: TournamentFormat,
) {
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

  const [step, setStep] = useState<WizardStep>(1);
  const [deporte, setDeporte] = useState<TournamentSport>('PADEL');
  const [formato, setFormato] = useState<TournamentFormat>('AMERICANO');

  const [nombre, setNombre] = useState('Americano');
  const [numParejas, setNumParejas] = useState(12);
  const [groupConfig, setGroupConfig] = useState(() => calcGroups(12));
  const [pairMode, setPairMode] = useState<PairMode>('CUSTOM');
  const [parejas, setParejas] = useState<PairDraft[]>(createEmptyPairs(12));

  const [footballHalfDuration, setFootballHalfDuration] = useState(20);
  const [footballHomeAway, setFootballHomeAway] = useState(false);
  const [tennisMode, setTennisMode] = useState<TennisMode>('SINGLES');
  const [superTiebreakThirdSet, setSuperTiebreakThirdSet] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSport =
    TOURNAMENT_SPORT_OPTIONS.find((option) => option.id === deporte) ?? TOURNAMENT_SPORT_OPTIONS[0];
  const selectedFormat =
    TOURNAMENT_FORMAT_OPTIONS.find((option) => option.id === formato) ?? TOURNAMENT_FORMAT_OPTIONS[0];
  const groupOptions = useMemo(() => listGroupConfigs(numParejas), [numParejas]);
  const displayedGroupOptions = useMemo(() => {
    if (formato !== 'LARGO') {
      return groupOptions;
    }
    return [...groupOptions].sort((a, b) => b.g4 - a.g4 || a.g3 - b.g3);
  }, [formato, groupOptions]);
  const combinationEnabled = isTournamentCombinationEnabled(deporte, formato);
  const usesGroupZones = deporte === 'PADEL' && (formato === 'AMERICANO' || formato === 'LARGO');
  const requiresPairDetails = usesGroupZones;
  const participantLabel = selectedSport.participantsLabel;

  const preview = useMemo(() => {
    if (!usesGroupZones) {
      return {
        ...groupConfig,
        qualifiers: 0,
        bracketSize: 0,
        byes: 0,
      };
    }

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
  }, [formato, groupConfig, numParejas, usesGroupZones]);

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
  const canSubmit =
    !submitting &&
    combinationEnabled &&
    (!requiresPairDetails || pairMode === 'GENERIC' || invalidCount === 0);

  const dynamicConfig = useMemo(() => {
    if (deporte === 'FUTBOL') {
      return {
        duracionTiempo: footballHalfDuration,
        ...(formato === 'LARGO' ? { idaVuelta: footballHomeAway } : {}),
      };
    }
    if (deporte === 'TENIS') {
      return {
        modalidad: tennisMode,
        superTiebreakTercerSet: superTiebreakThirdSet,
      };
    }
    if (deporte === 'PADEL' && formato === 'LARGO') {
      return {
        superTiebreakTercerSet: superTiebreakThirdSet,
        qualifiersByGroupSize: LARGO_QUALIFIERS_BY_GROUP_SIZE,
      };
    }
    return {};
  }, [deporte, footballHalfDuration, footballHomeAway, formato, superTiebreakThirdSet, tennisMode]);

  function updateCount(next: number) {
    const value = Math.max(MIN_PAREJAS, Math.min(MAX_PAREJAS, next));
    setNumParejas(value);
    const nextOptions = listGroupConfigs(value);
    const preferred = pickPreferredGroupConfig(nextOptions, formato);
    if (nextOptions.length > 0) {
      setGroupConfig((current) => {
        if (formato === 'LARGO' && preferred) {
          return preferred;
        }
        return nextOptions.some((option) => sameFormat(option, current)) ? current : (preferred ?? nextOptions[0]);
      });
    }
    setParejas((current) =>
      Array.from({ length: value }, (_, idx) => current[idx] ?? { jugador1: '', jugador2: '' }),
    );
  }

  function goToStep(next: WizardStep) {
    setStep(next);
  }

  function selectSport(next: TournamentSport) {
    setDeporte(next);

    if (!isFormatSupportedForSport(next, formato)) {
      const fallback = TOURNAMENT_FORMAT_OPTIONS.find((option) => option.supportedSports.includes(next));
      if (fallback) {
        setFormato(fallback.id);
        const fallbackOptions = listGroupConfigs(numParejas);
        const preferred = pickPreferredGroupConfig(fallbackOptions, fallback.id);
        if (preferred) {
          setGroupConfig(preferred);
        }
      }
    }

    if (step < 2) {
      setStep(2);
    }
  }

  function selectFormat(next: TournamentFormat) {
    setFormato(next);
    const nextOptions = listGroupConfigs(numParejas);
    const preferred = pickPreferredGroupConfig(nextOptions, next);
    if (preferred) {
      setGroupConfig((current) => {
        if (next === 'LARGO') {
          return preferred;
        }
        return nextOptions.some((option) => sameFormat(option, current)) ? current : preferred;
      });
    }
    if (step < 3) {
      setStep(3);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setSubmitting(true);
    setError(null);

    if (!combinationEnabled) {
      setSubmitting(false);
      setError('La combinacion elegida todavia no esta habilitada. Hoy funcionan PADEL + AMERICANO y PADEL + LARGO.');
      showToast({ message: 'La combinacion seleccionada estara disponible en la siguiente fase.', tone: 'error' });
      return;
    }

    if (requiresPairDetails && pairMode === 'CUSTOM' && invalidCount > 0) {
      setSubmitting(false);
      setError('Completa Nombre 1 y Nombre 2 con formato valido en todas las parejas.');
      showToast({ message: 'Revisa los nombres de las parejas personalizadas.', tone: 'error' });
      return;
    }

    const body = {
      nombre: nombre.trim(),
      deporte,
      formato,
      numParejas,
      pairMode: requiresPairDetails ? pairMode : ('GENERIC' as const),
      ...(requiresPairDetails && pairMode === 'CUSTOM'
        ? {
            parejas: normalizedParejas,
          }
        : {}),
      ...(usesGroupZones
        ? {
            formatoGrupos: groupConfig,
          }
        : {}),
      ...(Object.keys(dynamicConfig).length > 0
        ? {
            config: dynamicConfig,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Competition Ribbon</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-dim)]">Deporte</p>
            <p className="mt-1 font-bold text-[var(--text)]">
              {selectedSport.badge} {selectedSport.title}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-dim)]">Formato</p>
            <p className="mt-1 font-bold text-[var(--text)]">
              {selectedFormat.badge} {selectedFormat.title}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-dim)]">Estado</p>
            <p className={`mt-1 font-bold ${combinationEnabled ? 'text-[var(--green)]' : 'text-[var(--yellow)]'}`}>
              {combinationEnabled ? 'Disponible ahora' : 'Proximamente'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {STEP_LABELS.map((label, index) => {
            const itemStep = (index + 1) as WizardStep;
            const active = itemStep === step;
            const done = itemStep < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => goToStep(itemStep)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                    : done
                      ? 'border-[var(--green)]/50 bg-[var(--green)]/10 text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em]">Paso {itemStep}</p>
                <p className="mt-1 text-sm font-semibold">{label}</p>
              </button>
            );
          })}
        </div>
      </section>

      {step === 1 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Elegi deporte
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {TOURNAMENT_SPORT_OPTIONS.map((option) => {
              const active = option.id === deporte;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectSport(option.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  <p className="text-lg font-bold">
                    {option.badge} {option.title}
                  </p>
                  <p className="mt-2 text-sm">{option.description}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Elegi formato
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {TOURNAMENT_FORMAT_OPTIONS.map((option) => {
              const supported = option.supportedSports.includes(deporte);
              const active = option.id === formato;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!supported}
                  onClick={() => selectFormat(option.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    !supported
                      ? 'cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] opacity-50'
                      : active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  <p className="text-lg font-bold">
                    {option.badge} {option.title}
                  </p>
                  <p className="mt-2 text-sm">{option.description}</p>
                  {!supported ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em]">No disponible</p>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!isTournamentCombinationEnabled(deporte, formato) ? (
            <p className="mt-4 rounded-xl border border-[var(--yellow)]/50 bg-[var(--yellow)]/10 px-3 py-2 text-sm text-[var(--yellow)]">
              Esta combinacion queda preparada a nivel arquitectura, pero todavia no esta habilitada en produccion.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <>
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Cantidad de {participantLabel}
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

            {usesGroupZones ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  Formato de zonas
                </p>
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
                              ? 'Incluye grupos de 4 (con Ronda 2).'
                              : 'Incluye zonas de 4 con todos contra todos.'
                            : 'Solo zonas de 3.'}
                        </p>
                        {formato === 'LARGO' && option.g4 > 0 ? (
                          <p className="mt-1 text-[11px] font-semibold text-[var(--accent)]">
                            Recomendado para largo
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          {usesGroupZones ? (
            <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3">
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
            </section>
          ) : (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--text-muted)]">
                El formato {selectedFormat.title} usara fechas y tabla segun el deporte elegido. Este paso queda listo
                para activacion en la siguiente iteracion.
              </p>
            </section>
          )}

          {deporte === 'FUTBOL' || deporte === 'TENIS' || (deporte === 'PADEL' && formato === 'LARGO') ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Configuracion especifica
              </p>

              {deporte === 'FUTBOL' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-[var(--text-muted)]">
                    Duracion por tiempo
                    <select
                      value={footballHalfDuration}
                      onChange={(event) => setFootballHalfDuration(Number(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    >
                      {[15, 20, 25, 30, 35, 40, 45].map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} min
                        </option>
                      ))}
                    </select>
                  </label>

                  {formato === 'LARGO' ? (
                    <button
                      type="button"
                      onClick={() => setFootballHomeAway((current) => !current)}
                      className={`rounded-lg border px-3 py-2 text-left ${
                        footballHomeAway
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                      }`}
                    >
                      <p className="text-sm font-semibold">Ida y vuelta</p>
                      <p className="text-xs">{footballHomeAway ? 'Habilitado' : 'Partido unico'}</p>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {deporte === 'TENIS' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTennisMode('SINGLES')}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      tennisMode === 'SINGLES'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    <p className="text-sm font-semibold">Singles</p>
                    <p className="text-xs">1 jugador por participante</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTennisMode('DOBLES')}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      tennisMode === 'DOBLES'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    <p className="text-sm font-semibold">Dobles</p>
                    <p className="text-xs">2 jugadores por participante</p>
                  </button>
                </div>
              ) : null}

              {(deporte === 'TENIS' || (deporte === 'PADEL' && formato === 'LARGO')) ? (
                <button
                  type="button"
                  onClick={() => setSuperTiebreakThirdSet((current) => !current)}
                  className={`mt-3 rounded-lg border px-3 py-2 text-left ${
                    superTiebreakThirdSet
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  <p className="text-sm font-semibold">Super tie-break en set final</p>
                  <p className="text-xs">{superTiebreakThirdSet ? 'Habilitado' : 'Set completo'}</p>
                </button>
              ) : null}
            </section>
          ) : null}

          {requiresPairDetails ? (
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
          ) : null}

          {requiresPairDetails && pairMode === 'CUSTOM' ? (
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
                                current.map((item, i) => (i === idx ? { ...item, jugador1: event.target.value } : item)),
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
                                current.map((item, i) => (i === idx ? { ...item, jugador2: event.target.value } : item)),
                              )
                            }
                            className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--text)] outline-none ${
                              showErrors &&
                              (validation?.missingJugador2 || validation?.invalidJugador2 || validation?.samePlayers)
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
                  Hay {invalidCount} pareja{invalidCount === 1 ? '' : 's'} incompleta
                  {invalidCount === 1 ? '' : 's'} o invalida{invalidCount === 1 ? '' : 's'}.
                </p>
              ) : null}
            </section>
          ) : null}

          {requiresPairDetails && pairMode === 'GENERIC' ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--text-muted)]">
                Se guardaran automaticamente como <span className="font-semibold text-[var(--text)]">Pareja 1</span>,{' '}
                <span className="font-semibold text-[var(--text)]">Pareja 2</span> ...{' '}
                <span className="font-semibold text-[var(--text)]">Pareja {numParejas}</span>.
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => (current > 1 ? ((current - 1) as WizardStep) : current))}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)]"
          >
            Volver
          </button>
        ) : null}

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((current) => (current < 3 ? ((current + 1) as WizardStep) : current))}
            className="h-11 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110"
          >
            Continuar
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-6 text-base font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creando...' : combinationEnabled ? 'Crear Torneo' : 'Combinacion no disponible'}
          </button>
        )}
      </div>
    </form>
  );
}
