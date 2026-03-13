"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ScoreInputLargo } from "@/components/tournament/ScoreInputLargo";
import { useLatestValueRef } from "@/components/tournament/shared/useLatestValueRef";
import {
  getMatchSavePresentation,
  useMatchSaveState,
} from "@/components/tournament/shared/useMatchSaveState";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";
import {
  createEmptyPadelLargoDraft,
  createPadelLargoWalkoverScore,
  evaluatePadelLargoDraft,
  parsePadelLargoScore,
  toPadelLargoDraft,
  type PadelLargoScore,
  type PadelLargoScoreDraft,
} from "@/lib/tournament-engine/scoring/padel-largo";

type Pair = {
  id: string;
  nombre: string;
};

type Match = {
  id: string;
  ronda: number;
  posicion: number;
  esBye: boolean;
  pareja1Id: string | null;
  pareja2Id: string | null;
  ganadorId: string | null;
  gamesPareja1: number | null;
  gamesPareja2: number | null;
  scoreJson: unknown;
  walkover: boolean;
  completado: boolean;
};

type BracketData = {
  id: string;
  totalRondas: number;
  matches: Match[];
};

type LargoBracketClientProps = {
  torneoId: string;
  torneoNombre: string;
  pairs: Pair[];
  bracket: BracketData;
  allowSuperTiebreakThirdSet: boolean;
  readOnly?: boolean;
};

type DraftMap = Record<string, PadelLargoScoreDraft>;
const INCOMPLETE_WARNING_GRACE_MS = 8_000;

function roundLabel(matchesInRound: number, round: number, totalRounds: number) {
  if (matchesInRound === 16) return "16avos";
  if (matchesInRound === 8) return "8vos";
  if (matchesInRound === 4) return "4tos";
  if (matchesInRound === 2) return "Semifinal";
  if (matchesInRound === 1 || round === totalRounds) return "Final";
  return `Ronda ${round}`;
}

function initDrafts(matches: Match[]): DraftMap {
  const out: DraftMap = {};
  for (const match of matches) {
    out[match.id] = toPadelLargoDraft(parsePadelLargoScore(match.scoreJson));
  }
  return out;
}

function mergeDraftsKeepingDrafts(current: DraftMap, matches: Match[]): DraftMap {
  const next: DraftMap = {};
  for (const match of matches) {
    if (match.completado) {
      next[match.id] = toPadelLargoDraft(parsePadelLargoScore(match.scoreJson));
    } else {
      next[match.id] = current[match.id] ?? createEmptyPadelLargoDraft();
    }
  }
  return next;
}

export function LargoBracketClient({
  torneoId,
  torneoNombre,
  pairs,
  bracket: initialBracket,
  allowSuperTiebreakThirdSet,
  readOnly = false,
}: LargoBracketClientProps) {
  const { showToast } = useToast();
  const pairById = useMemo(() => Object.fromEntries(pairs.map((pair) => [pair.id, pair])), [pairs]);
  const [bracket, setBracket] = useState(initialBracket);
  const [drafts, setDrafts] = useState<DraftMap>(() => initDrafts(initialBracket.matches));
  const draftsRef = useLatestValueRef(drafts);
  const draftTouchedAtRef = useRef<Record<string, number>>({});
  const bracketRef = useLatestValueRef(bracket);
  const { matchSaveState, setMatchSaveState } = useMatchSaveState(
    bracket.matches,
  );
  const [savingMatch, setSavingMatch] = useState<string | null>(null);

  const rounds = useMemo(() => {
    const grouped: Array<{ round: number; matches: Match[] }> = [];
    for (let round = 1; round <= bracket.totalRondas; round += 1) {
      grouped.push({
        round,
        matches: bracket.matches.filter((match) => match.ronda === round).sort((a, b) => a.posicion - b.posicion),
      });
    }
    return grouped;
  }, [bracket]);

  const finalMatch = rounds[rounds.length - 1]?.matches[0];
  const champion = finalMatch?.completado && finalMatch.ganadorId ? pairById[finalMatch.ganadorId] : null;

  function applyOptimisticBracket(match: Match, score: PadelLargoScore) {
    const winner = evaluatePadelLargoDraft(toPadelLargoDraft(score), {
      allowSuperTiebreakThirdSet,
    });
    if (winner.status !== "valid") {
      return bracket;
    }

    const winnerId = winner.winner === "p1" ? match.pareja1Id : match.pareja2Id;
    if (!winnerId) {
      return bracket;
    }

    const nextRound = match.ronda + 1;
    const nextPos = Math.floor(match.posicion / 2);
    const nextSlot = match.posicion % 2 === 0 ? "pareja1Id" : "pareja2Id";

    return {
      ...bracket,
      matches: bracket.matches.map((item) => {
        if (item.id === match.id) {
          return {
            ...item,
            scoreJson: score,
            walkover: Boolean(score.walkover),
            ganadorId: winnerId,
            completado: true,
          };
        }
        if (item.ronda === nextRound && item.posicion === nextPos) {
          return { ...item, [nextSlot]: winnerId };
        }
        return item;
      }),
    };
  }

  async function saveResult(match: Match, explicitScore?: PadelLargoScore) {
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
    const prevBracket = bracketRef.current;
    const prevDrafts = draftsRef.current;

    setBracket(applyOptimisticBracket(match, score));
    setDrafts((current) => ({
      ...current,
      [match.id]: toPadelLargoDraft(score),
    }));
    setMatchSaveState((current) => ({ ...current, [match.id]: "saving" }));
    setSavingMatch(match.id);

    try {
      const response = await authFetch(`/api/torneo/${torneoId}/resultado-bracket`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          score,
        }),
      });

      const payload = (await response.json()) as
        | { success: true; data: { id: string; totalRondas: number; matches: Match[] } }
        | { success: false; error: string };

      if (!payload.success) {
        setBracket(prevBracket);
        setDrafts(prevDrafts);
        setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void saveResult(match, score);
          },
        });
        return;
      }

      setBracket({
        id: payload.data.id,
        totalRondas: payload.data.totalRondas,
        matches: payload.data.matches,
      });
      setDrafts((current) => mergeDraftsKeepingDrafts(current, payload.data.matches));
      setMatchSaveState((current) => ({ ...current, [match.id]: "saved" }));
    } catch {
      setBracket(prevBracket);
      setDrafts(prevDrafts);
      setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
      showToast({
        message: "No se pudo guardar el resultado.",
        tone: "error",
        onRetry: () => {
          void saveResult(match, score);
        },
      });
    } finally {
      setSavingMatch(null);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-3xl font-extrabold text-[var(--text)]">Cuadro eliminatorio · Largo</h1>
        <p className="text-sm text-[var(--text-muted)]">{torneoNombre}</p>
      </header>

      {champion ? (
        <div className="rounded-2xl border border-[var(--gold)]/70 bg-[var(--gold)]/15 px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">Campeon</p>
          <p className="mt-1 text-2xl font-black text-[var(--gold)]">🏆 {champion.nombre}</p>
          <div className="mt-3">
            <Link
              href="/torneos/create"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--text-on-gold)] transition hover:brightness-110"
            >
              Crear otro torneo
            </Link>
          </div>
        </div>
      ) : null}

      {readOnly ? (
        <p className="text-sm font-semibold text-[var(--text-muted)]">Vista pública de solo lectura.</p>
      ) : null}

      <div className="-mx-4 snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-4 md:gap-6">
          {rounds.map((roundBlock, index) => {
            const gap = 22 * 2 ** index;
            return (
              <div key={roundBlock.round} className="w-[92vw] max-w-[340px] shrink-0 snap-start md:w-[340px]">
                <p className="mb-3 text-sm font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {roundLabel(roundBlock.matches.length, roundBlock.round, bracket.totalRondas)}
                </p>
                <div>
                  {roundBlock.matches.map((match, matchIndex) => {
                    const p1 = match.pareja1Id ? pairById[match.pareja1Id] : null;
                    const p2 = match.pareja2Id ? pairById[match.pareja2Id] : null;
                    const unresolved = !p1 || !p2;
                    const state = matchSaveState[match.id] ?? (match.completado ? "saved" : "idle");
                    const statePresentation = getMatchSavePresentation(readOnly, state);

                    return (
                      <div key={match.id} style={{ marginTop: matchIndex === 0 ? 0 : gap }}>
                        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                          {unresolved ? (
                            <div className="space-y-2">
                              <p className="truncate text-sm font-semibold text-[var(--text-dim)]">{p1?.nombre ?? "Por definir"}</p>
                              <p className="truncate text-sm font-semibold text-[var(--text-dim)]">{p2?.nombre ?? "Por definir"}</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <ScoreInputLargo
                                draft={drafts[match.id] ?? createEmptyPadelLargoDraft()}
                                onChange={(nextDraft) => {
                                  draftTouchedAtRef.current[match.id] = Date.now();
                                  setDrafts((current) => ({ ...current, [match.id]: nextDraft }));
                                  setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
                                }}
                                allowSuperTiebreakThirdSet={allowSuperTiebreakThirdSet}
                                leftLabel={p1.nombre}
                                rightLabel={p2.nombre}
                                disabled={readOnly || savingMatch === match.id}
                                onBlur={() => {
                                  if (!readOnly) {
                                    void saveResult(match);
                                  }
                                }}
                              />

                              {!readOnly ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={savingMatch === match.id}
                                    onClick={() => {
                                      void saveResult(match, createPadelLargoWalkoverScore("p1"));
                                    }}
                                    className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-60"
                                  >
                                    W.O. {p1.nombre}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingMatch === match.id}
                                    onClick={() => {
                                      void saveResult(match, createPadelLargoWalkoverScore("p2"));
                                    }}
                                    className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-60"
                                  >
                                    W.O. {p2.nombre}
                                  </button>
                                </div>
                              ) : null}

                              {!readOnly ? (
                                <span
                                  className={`inline-flex h-9 w-full items-center justify-center rounded-lg border text-xs font-bold uppercase tracking-[0.08em] ${statePresentation.className}`}
                                >
                                  {statePresentation.label}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
