"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScoreInput } from "@/components/tournament/ScoreInput";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";
import { isValidMatchScore, mergeScoresKeepingDrafts, parseDraftScore } from "@/lib/score-utils";

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
  completado: boolean;
};

type BracketData = {
  id: string;
  totalRondas: number;
  matches: Match[];
};

type BracketClientProps = {
  torneoId: string;
  torneoNombre: string;
  pairs: Pair[];
  bracket: BracketData;
  readOnly?: boolean;
};
type MatchSaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type MatchSaveStateMap = Record<string, MatchSaveState>;

function initScores(matches: Match[]) {
  return mergeScoresKeepingDrafts({}, matches);
}

function initMatchSaveState(matches: Match[]): MatchSaveStateMap {
  const out: MatchSaveStateMap = {};
  for (const match of matches) {
    out[match.id] = match.completado ? "saved" : "idle";
  }
  return out;
}

function roundLabel(matchesInRound: number, round: number, totalRounds: number) {
  if (matchesInRound === 16) return "16avos";
  if (matchesInRound === 8) return "8vos";
  if (matchesInRound === 4) return "4tos";
  if (matchesInRound === 2) return "Semifinal";
  if (matchesInRound === 1 || round === totalRounds) return "Final";
  return `Ronda ${round}`;
}

export function BracketClient({
  torneoId,
  torneoNombre,
  pairs,
  bracket: initialBracket,
  readOnly = false,
}: BracketClientProps) {
  const { showToast } = useToast();
  const pairById = useMemo(() => Object.fromEntries(pairs.map((pair) => [pair.id, pair])), [pairs]);
  const [bracket, setBracket] = useState(initialBracket);
  const [scores, setScores] = useState(initScores(initialBracket.matches));
  const scoresRef = useRef(scores);
  const bracketRef = useRef(bracket);
  const [matchSaveState, setMatchSaveState] = useState<MatchSaveStateMap>(
    initMatchSaveState(initialBracket.matches),
  );
  const [savingMatch, setSavingMatch] = useState<string | null>(null);

  const rounds = useMemo(() => {
    const grouped: Array<{ round: number; matches: Match[] }> = [];
    for (let r = 1; r <= bracket.totalRondas; r += 1) {
      grouped.push({
        round: r,
        matches: bracket.matches.filter((match) => match.ronda === r).sort((a, b) => a.posicion - b.posicion),
      });
    }
    return grouped;
  }, [bracket]);

  const finalMatch = rounds[rounds.length - 1]?.matches[0];
  const champion = finalMatch?.completado && finalMatch.ganadorId ? pairById[finalMatch.ganadorId] : null;

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    bracketRef.current = bracket;
  }, [bracket]);

  useEffect(() => {
    setMatchSaveState((current) => {
      const next = { ...current };
      for (const match of bracket.matches) {
        if (!next[match.id]) {
          next[match.id] = match.completado ? "saved" : "idle";
        }
      }
      return next;
    });
  }, [bracket.matches]);

  function applyOptimisticBracket(match: Match, s1: number, s2: number) {
    const winnerId = s1 > s2 ? match.pareja1Id : match.pareja2Id;
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
            gamesPareja1: s1,
            gamesPareja2: s2,
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

  function saveOnBlur(match: Match) {
    void saveResult(match, undefined, { quietValidation: true });
  }

  async function saveResult(
    match: Match,
    explicit?: { s1: number; s2: number },
    options?: { quietValidation?: boolean },
  ) {
    if (readOnly) {
      return;
    }
    const source = scoresRef.current;
    const s1 = explicit?.s1 ?? parseDraftScore(source[match.id]?.s1);
    const s2 = explicit?.s2 ?? parseDraftScore(source[match.id]?.s2);
    if (s1 === null || s2 === null) {
      setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
      if (!options?.quietValidation) {
        showToast({ message: "Completa ambos scores.", tone: "error" });
      }
      return;
    }
    if (!isValidMatchScore(s1, s2)) {
      setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
      if (!options?.quietValidation) {
        showToast({ message: "Resultado invalido. Debe ser 6-x (x entre 0 y 5).", tone: "error" });
      }
      return;
    }

    const prevBracket = bracketRef.current;
    const prevScores = scoresRef.current;

    setBracket(applyOptimisticBracket(match, s1, s2));
    setScores((current) => ({
      ...current,
      [match.id]: { s1: String(s1), s2: String(s2) },
    }));
    setMatchSaveState((current) => ({ ...current, [match.id]: "saving" }));
    setSavingMatch(match.id);
    try {
      const response = await authFetch(`/api/torneo/${torneoId}/resultado-bracket`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          gamesPareja1: s1,
          gamesPareja2: s2,
        }),
      });

      const payload = (await response.json()) as
        | { success: true; data: { id: string; totalRondas: number; matches: Match[] } }
        | { success: false; error: string };

      if (!payload.success) {
        setBracket(prevBracket);
        setScores(prevScores);
        setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void saveResult(match, { s1, s2 });
          },
        });
        return;
      }

      setBracket({
        id: payload.data.id,
        totalRondas: payload.data.totalRondas,
        matches: payload.data.matches,
      });
      setScores((current) => mergeScoresKeepingDrafts(current, payload.data.matches));
      setMatchSaveState((current) => ({ ...current, [match.id]: "saved" }));
    } catch {
      setBracket(prevBracket);
      setScores(prevScores);
      setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
      showToast({
        message: "No se pudo guardar el resultado.",
        tone: "error",
        onRetry: () => {
          void saveResult(match, { s1, s2 });
        },
      });
    } finally {
      setSavingMatch(null);
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-3xl font-extrabold text-[var(--text)]">Cuadro eliminatorio</h1>
        <p className="text-sm text-[var(--text-muted)]">{torneoNombre}</p>
      </header>

      {champion ? (
        <div className="rounded-2xl border border-[var(--gold)]/70 bg-[var(--gold)]/15 px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">Campeon</p>
          <p className="mt-1 text-2xl font-black text-[var(--gold)]">🏆 {champion.nombre}</p>
          <div className="mt-3">
            <Link
              href="/torneos/create"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--gold)] bg-[var(--gold)] px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[#1f2937] transition hover:brightness-110"
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
            const gap = 18 * 2 ** index;
            return (
              <div key={roundBlock.round} className="w-[86vw] max-w-[280px] shrink-0 snap-start md:w-[280px]">
                <p className="mb-3 text-sm font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {roundLabel(roundBlock.matches.length, roundBlock.round, bracket.totalRondas)}
                </p>
                <div>
                  {roundBlock.matches.map((match, matchIndex) => {
                    const p1 = match.pareja1Id ? pairById[match.pareja1Id] : null;
                    const p2 = match.pareja2Id ? pairById[match.pareja2Id] : null;
                    const byeOnly = match.esBye && (p1 || p2) && !(p1 && p2);
                    const unresolved = !p1 || !p2;
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
                      <div key={match.id} style={{ marginTop: matchIndex === 0 ? 0 : gap }}>
                        <article
                          className={`rounded-xl border p-3 ${
                            byeOnly
                              ? "border-[var(--purple)]/50 bg-[var(--purple)]/10 opacity-80"
                              : "border-[var(--border)] bg-[var(--surface)]"
                          }`}
                        >
                          {byeOnly ? (
                            <div className="flex items-center justify-between">
                              <span className="truncate font-semibold text-[var(--text)]">{(p1 ?? p2)?.nombre}</span>
                              <span className="rounded-md border border-[var(--purple)]/70 bg-[var(--purple)]/20 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--purple)]">
                                BYE →
                              </span>
                            </div>
                          ) : unresolved ? (
                            <div className="space-y-2">
                              <p className="truncate text-sm font-semibold text-[var(--text-dim)]">{p1?.nombre ?? "Por definir"}</p>
                              <p className="truncate text-sm font-semibold text-[var(--text-dim)]">{p2?.nombre ?? "Por definir"}</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {[p1, p2].map((pair, idx) => {
                                const isWinner = match.completado && match.ganadorId === pair.id;
                                return (
                                  <div
                                    key={pair.id}
                                    className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border px-2 py-1 ${
                                      isWinner
                                        ? "border-[var(--green)]/70 bg-[var(--green)]/15"
                                        : "border-[var(--border)] bg-[var(--surface-2)]"
                                    }`}
                                  >
                                    <span
                                      className={`truncate text-sm font-semibold ${
                                        isWinner ? "text-[var(--green)]" : "text-[var(--text)]"
                                      }`}
                                    >
                                      {isWinner ? "▶ " : ""}
                                      {pair.nombre}
                                    </span>
                                    <ScoreInput
                                      value={idx === 0 ? scores[match.id]?.s1 ?? "" : scores[match.id]?.s2 ?? ""}
                                      name={`bracket-${match.id}-p${idx + 1}`}
                                      ariaLabel={`Score ${pair.nombre} ronda ${roundBlock.round}`}
                                      disabled={readOnly || savingMatch === match.id}
                                      onChange={(value) => {
                                        setScores((current) => ({
                                          ...current,
                                          [match.id]:
                                            idx === 0
                                              ? { s1: value, s2: current[match.id]?.s2 ?? "" }
                                              : { s1: current[match.id]?.s1 ?? "", s2: value },
                                        }));
                                        setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
                                      }}
                                      onBlur={() => {
                                        if (!readOnly) {
                                          saveOnBlur(match);
                                        }
                                      }}
                                    />
                                  </div>
                                );
                              })}
                              {!readOnly ? (
                                <span
                                  className={`mt-1 inline-flex h-9 w-full items-center justify-center rounded-lg border text-xs font-bold uppercase tracking-[0.08em] ${stateStyle}`}
                                >
                                  {stateLabel}
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
