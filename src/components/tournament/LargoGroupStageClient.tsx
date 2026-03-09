"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GroupCard } from "@/components/tournament/GroupCard";
import { ParejaName } from "@/components/tournament/ParejaName";
import { ScoreInputLargo } from "@/components/tournament/ScoreInputLargo";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";
import {
  createEmptyPadelLargoDraft,
  createPadelLargoWalkoverScore,
  evaluatePadelLargoDraft,
  getPadelLargoMatchStats,
  parsePadelLargoScore,
  toPadelLargoDraft,
  type PadelLargoScore,
  type PadelLargoScoreDraft,
} from "@/lib/tournament-engine/scoring/padel-largo";

type Pair = {
  id: string;
  nombre: string;
};

type GroupMatch = {
  id: string;
  fase: "RONDA1" | "RONDA2";
  orden: number;
  pareja1Id: string;
  pareja2Id: string;
  gamesPareja1: number | null;
  gamesPareja2: number | null;
  scoreJson: unknown;
  walkover: boolean;
  completado: boolean;
};

type Group = {
  id: string;
  nombre: string;
  parejas: Pair[];
  partidos: GroupMatch[];
};

type TorneoData = {
  id: string;
  nombre: string;
  formato: string;
  config?: Record<string, unknown> | null;
  grupos: Group[];
};

type LargoGroupStageClientProps = {
  torneo: TorneoData;
  readOnly?: boolean;
};

type MatchSaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type MatchSaveStateMap = Record<string, MatchSaveState>;
type DraftMap = Record<string, PadelLargoScoreDraft>;
const INCOMPLETE_WARNING_GRACE_MS = 8_000;

function initDrafts(groups: Group[]): DraftMap {
  const out: DraftMap = {};
  for (const group of groups) {
    for (const match of group.partidos) {
      out[match.id] = toPadelLargoDraft(parsePadelLargoScore(match.scoreJson));
    }
  }
  return out;
}

function mergeDraftsKeepingDrafts(current: DraftMap, groups: Group[]): DraftMap {
  const next: DraftMap = {};
  for (const group of groups) {
    for (const match of group.partidos) {
      if (match.completado) {
        next[match.id] = toPadelLargoDraft(parsePadelLargoScore(match.scoreJson));
      } else {
        next[match.id] = current[match.id] ?? createEmptyPadelLargoDraft();
      }
    }
  }
  return next;
}

function initMatchSaveState(groups: Group[]): MatchSaveStateMap {
  const out: MatchSaveStateMap = {};
  for (const group of groups) {
    for (const match of group.partidos) {
      out[match.id] = match.completado ? "saved" : "idle";
    }
  }
  return out;
}

function isComplete(group: Group) {
  return group.partidos.length > 0 && group.partidos.every((match) => match.completado);
}

function readAllowSuperTiebreak(config: Record<string, unknown> | null | undefined): boolean {
  return Boolean(config?.superTiebreakTercerSet);
}

export function LargoGroupStageClient({ torneo: initialTorneo, readOnly = false }: LargoGroupStageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [torneo, setTorneo] = useState(initialTorneo);
  const [drafts, setDrafts] = useState<DraftMap>(() => initDrafts(initialTorneo.grupos));
  const draftsRef = useRef(drafts);
  const draftTouchedAtRef = useRef<Record<string, number>>({});
  const torneoRef = useRef(torneo);
  const [matchSaveState, setMatchSaveState] = useState<MatchSaveStateMap>(() =>
    initMatchSaveState(initialTorneo.grupos),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const allowSuperTiebreakThirdSet = readAllowSuperTiebreak(torneo.config);
  const allComplete = useMemo(() => torneo.grupos.every(isComplete), [torneo.grupos]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    torneoRef.current = torneo;
  }, [torneo]);

  useEffect(() => {
    setMatchSaveState((current) => {
      const next = { ...current };
      for (const group of torneo.grupos) {
        for (const match of group.partidos) {
          if (!next[match.id]) {
            next[match.id] = match.completado ? "saved" : "idle";
          }
        }
      }
      return next;
    });
  }, [torneo.grupos]);

  function applyOptimisticMatch(current: TorneoData, match: GroupMatch, score: PadelLargoScore): TorneoData {
    const stats = getPadelLargoMatchStats(score);
    return {
      ...current,
      grupos: current.grupos.map((group) => ({
        ...group,
        partidos: group.partidos.map((item) =>
          item.id === match.id
            ? {
                ...item,
                gamesPareja1: stats.gamesP1,
                gamesPareja2: stats.gamesP2,
                scoreJson: score,
                walkover: Boolean(score.walkover),
                completado: true,
              }
            : item,
        ),
      })),
    };
  }

  async function saveMatch(match: GroupMatch, explicitScore?: PadelLargoScore) {
    if (readOnly) {
      return;
    }

    const draft = draftsRef.current[match.id] ?? createEmptyPadelLargoDraft();
    const evaluation = explicitScore
      ? {
          status: "valid" as const,
          score: explicitScore,
        }
      : evaluatePadelLargoDraft(draft, {
          allowSuperTiebreakThirdSet,
        });

    if (evaluation.status === "incomplete") {
      setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
      const touchedAt = draftTouchedAtRef.current[match.id];
      const elapsed = touchedAt ? Date.now() - touchedAt : Number.POSITIVE_INFINITY;
      if (elapsed < INCOMPLETE_WARNING_GRACE_MS) {
        return;
      }
      showToast({ message: "Completa el score para guardar.", tone: "error" });
      return;
    }
    if (evaluation.status === "invalid") {
      setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
      showToast({ message: evaluation.message, tone: "error" });
      return;
    }

    const score = evaluation.score;
    const prevTorneo = torneoRef.current;
    const prevDrafts = draftsRef.current;

    setTorneo((current) => applyOptimisticMatch(current, match, score));
    setDrafts((current) => ({
      ...current,
      [match.id]: toPadelLargoDraft(score),
    }));
    setMatchSaveState((current) => ({ ...current, [match.id]: "saving" }));
    setSavingId(match.id);

    try {
      const response = await authFetch(`/api/torneo/${torneo.id}/resultado-grupo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoId: match.id,
          score,
        }),
      });

      const payload = (await response.json()) as
        | { success: true; data: TorneoData }
        | { success: false; error: string };

      if (!payload.success) {
        setTorneo(prevTorneo);
        setDrafts(prevDrafts);
        setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void saveMatch(match, score);
          },
        });
        return;
      }

      setTorneo(payload.data);
      setDrafts((current) => mergeDraftsKeepingDrafts(current, payload.data.grupos));
      setMatchSaveState((current) => ({ ...current, [match.id]: "saved" }));
    } catch {
      setTorneo(prevTorneo);
      setDrafts(prevDrafts);
      setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
      showToast({
        message: "No se pudo guardar el resultado.",
        tone: "error",
        onRetry: () => {
          void saveMatch(match, score);
        },
      });
    } finally {
      setSavingId(null);
    }
  }

  async function handleRanking() {
    setLoadingRanking(true);
    try {
      const response = await authFetch(`/api/torneo/${torneo.id}/ranking`, {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { success: true; data: unknown }
        | { success: false; error: string };

      if (!payload.success) {
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void handleRanking();
          },
        });
        return;
      }

      router.push(`/torneo/${torneo.id}/ranking`);
    } catch {
      showToast({
        message: "No se pudo calcular el ranking.",
        tone: "error",
        onRetry: () => {
          void handleRanking();
        },
      });
    } finally {
      setLoadingRanking(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">{torneo.nombre}</h1>
          <p className="text-sm text-[var(--text-muted)]">Fase de zonas · Padel Largo</p>
        </div>
        <button
          disabled={!allComplete || loadingRanking}
          onClick={handleRanking}
          className="btn-primary h-11 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-dim)]"
        >
          {loadingRanking ? "Calculando…" : "Ver Ranking"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {torneo.grupos.map((group) => {
          const pairById = Object.fromEntries(group.parejas.map((pair) => [pair.id, pair]));
          const matches = [...group.partidos].sort((a, b) => a.orden - b.orden);

          return (
            <GroupCard key={group.id} groupName={group.nombre}>
              <div className="space-y-3">
                {matches.map((match) => {
                  const left = pairById[match.pareja1Id]?.nombre ?? "Pareja A";
                  const right = pairById[match.pareja2Id]?.nombre ?? "Pareja B";
                  const draft = drafts[match.id] ?? createEmptyPadelLargoDraft();
                  const state = matchSaveState[match.id] ?? (match.completado ? "saved" : "idle");
                  const stateStyle =
                    readOnly
                      ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
                      : state === "saving"
                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--accent)]"
                        : state === "saved"
                          ? "border-[var(--green)]/60 bg-[var(--green)]/15 text-[var(--green)]"
                          : state === "error"
                            ? "border-[var(--red)]/60 bg-[var(--red)]/15 text-[var(--red)]"
                            : state === "dirty"
                              ? "border-[var(--gold)]/60 bg-[var(--gold)]/15 text-[var(--gold)]"
                              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]";
                  const stateLabel =
                    readOnly
                      ? match.completado
                        ? "Final"
                        : "Pendiente"
                      : state === "saving"
                        ? "Guardando…"
                        : state === "saved"
                          ? "Guardado"
                          : state === "error"
                            ? "Error"
                            : state === "dirty"
                              ? "Sin guardar"
                              : "Pendiente";

                  return (
                    <article
                      key={match.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
                    >
                      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                        <ParejaName name={left} className="text-base" />
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">vs</span>
                        <ParejaName name={right} className="text-right text-base" />
                        <span
                          className={`col-span-3 mt-1 inline-flex h-8 items-center justify-center justify-self-end rounded-md border px-2 text-[10px] font-bold uppercase tracking-[0.06em] md:col-span-1 md:mt-0 ${stateStyle}`}
                        >
                          {stateLabel}
                        </span>
                      </div>

                      <ScoreInputLargo
                        draft={draft}
                        onChange={(nextDraft) => {
                          draftTouchedAtRef.current[match.id] = Date.now();
                          setDrafts((current) => ({ ...current, [match.id]: nextDraft }));
                          setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
                        }}
                        allowSuperTiebreakThirdSet={allowSuperTiebreakThirdSet}
                        leftLabel={left}
                        rightLabel={right}
                        disabled={readOnly || savingId === match.id}
                        onBlur={() => {
                          void saveMatch(match);
                        }}
                      />

                      {!readOnly ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={savingId === match.id}
                            onClick={() => {
                              void saveMatch(match, createPadelLargoWalkoverScore("p1"));
                            }}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-60"
                          >
                            W.O. {left}
                          </button>
                          <button
                            type="button"
                            disabled={savingId === match.id}
                            onClick={() => {
                              void saveMatch(match, createPadelLargoWalkoverScore("p2"));
                            }}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-60"
                          >
                            W.O. {right}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </GroupCard>
          );
        })}
      </div>
    </section>
  );
}
