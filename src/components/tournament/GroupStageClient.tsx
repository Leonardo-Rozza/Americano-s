"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GroupCard } from "@/components/tournament/GroupCard";
import { ParejaName } from "@/components/tournament/ParejaName";
import { ScoreInput } from "@/components/tournament/ScoreInput";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";
import { isValidMatchScore, mergeScoresKeepingDrafts, parseDraftScore } from "@/lib/score-utils";

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
  completado: boolean;
};

type Group = {
  id: string;
  nombre: string;
  parejas: Pair[];
  partidos: GroupMatch[];
};

type RankingRow = {
  pareja: Pair;
  gf: number;
  gc: number;
  diff: number;
};

type TorneoData = {
  id: string;
  nombre: string;
  grupos: Group[];
};

type GroupStageClientProps = {
  torneo: TorneoData;
  readOnly?: boolean;
};

type ScoresMap = Record<string, { s1: string; s2: string }>;
type MatchSaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type MatchSaveStateMap = Record<string, MatchSaveState>;

function initScores(groups: Group[]): ScoresMap {
  const out = groups.flatMap((group) => group.partidos);
  return mergeScoresKeepingDrafts({}, out);
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

export function GroupStageClient({ torneo: initialTorneo, readOnly = false }: GroupStageClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [torneo, setTorneo] = useState(initialTorneo);
  const [scores, setScores] = useState<ScoresMap>(initScores(initialTorneo.grupos));
  const scoresRef = useRef(scores);
  const torneoRef = useRef(torneo);
  const [matchSaveState, setMatchSaveState] = useState<MatchSaveStateMap>(
    initMatchSaveState(initialTorneo.grupos),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const allComplete = useMemo(() => torneo.grupos.every(isComplete), [torneo.grupos]);

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

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

  function applyOptimisticMatch(currentTorneo: TorneoData, match: GroupMatch, s1: number, s2: number): TorneoData {
    return {
      ...currentTorneo,
      grupos: currentTorneo.grupos.map((group) => ({
        ...group,
        partidos: group.partidos.map((item) =>
          item.id === match.id
            ? {
                ...item,
                gamesPareja1: s1,
                gamesPareja2: s2,
                completado: true,
              }
            : item,
        ),
      })),
    };
  }

  function saveOnBlur(match: GroupMatch) {
    if (readOnly) {
      return;
    }
    void saveMatch(match, undefined, { quietValidation: true });
  }

  async function saveMatch(
    match: GroupMatch,
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
        showToast({ message: "Completa ambos scores antes de guardar.", tone: "error" });
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

    const prevTorneo = torneoRef.current;
    const prevScores = scoresRef.current;
    setTorneo((current) => applyOptimisticMatch(current, match, s1, s2));
    setScores((current) => ({ ...current, [match.id]: { s1: String(s1), s2: String(s2) } }));
    setMatchSaveState((current) => ({ ...current, [match.id]: "saving" }));
    setSavingId(match.id);
    try {
      const response = await authFetch(`/api/torneo/${torneo.id}/resultado-grupo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoId: match.id,
          gamesPareja1: s1,
          gamesPareja2: s2,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; data: TorneoData }
        | { success: false; error: string };

      if (!payload.success) {
        setTorneo(prevTorneo);
        setScores(prevScores);
        setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void saveMatch(match, { s1, s2 });
          },
        });
        return;
      }

      setTorneo(payload.data);
      setScores((current) =>
        mergeScoresKeepingDrafts(
          current,
          payload.data.grupos.flatMap((group) => group.partidos),
        ),
      );
      setMatchSaveState((current) => ({ ...current, [match.id]: "saved" }));
    } catch {
      setTorneo(prevTorneo);
      setScores(prevScores);
      setMatchSaveState((current) => ({ ...current, [match.id]: "error" }));
      showToast({
        message: "No se pudo guardar el resultado.",
        tone: "error",
        onRetry: () => {
          void saveMatch(match, { s1, s2 });
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
        | { success: true; data: { ranking: RankingRow[] } }
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

      setRanking(payload.data.ranking);
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
          <p className="text-sm text-[var(--text-muted)]">Fase de grupos</p>
        </div>
        <button
          disabled={!allComplete || loadingRanking}
          onClick={handleRanking}
          className="h-11 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-dim)]"
        >
          {loadingRanking ? "Calculando…" : "Ver Ranking"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {torneo.grupos.map((group) => {
          const byId = Object.fromEntries(group.parejas.map((pair) => [pair.id, pair]));
          const round1 = group.partidos.filter((match) => match.fase === "RONDA1").sort((a, b) => a.orden - b.orden);
          const round2 = group.partidos.filter((match) => match.fase === "RONDA2").sort((a, b) => a.orden - b.orden);

          const sections =
            group.parejas.length === 4
              ? [
                  { key: "r1", title: "Ronda 1 — Sorteo", matches: round1 },
                  {
                    key: "r2",
                    title: "Ronda 2 — Ganador vs Ganador · Perdedor vs Perdedor",
                    matches: round2,
                  },
                ]
              : [{ key: "all", title: "Partidos", matches: round1 }];

          return (
            <GroupCard key={group.id} groupName={group.nombre}>
              <div className="space-y-5">
                {sections.map((section) =>
                  section.matches.length > 0 ? (
                    <div key={section.key}>
                      {group.parejas.length === 4 ? (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                          {section.title}
                        </p>
                      ) : null}
                      <div className="space-y-2">
                        {section.matches.map((match) => {
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
                            <div
                              key={match.id}
                              className="grid grid-cols-[1fr_auto_auto_auto_1fr_auto] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2"
                            >
                              <ParejaName name={byId[match.pareja1Id]?.nombre ?? "Pareja"} />
                              <ScoreInput
                                value={scores[match.id]?.s1 ?? ""}
                                name={`grupo-${group.id}-${match.id}-p1`}
                                ariaLabel={`Score ${byId[match.pareja1Id]?.nombre ?? "pareja 1"} en grupo ${group.nombre}`}
                                disabled={readOnly || savingId === match.id}
                                onChange={(next) => {
                                  setScores((current) => ({
                                    ...current,
                                    [match.id]: { s1: next, s2: current[match.id]?.s2 ?? "" },
                                  }));
                                  setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
                                }}
                                onBlur={() => saveOnBlur(match)}
                              />
                              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">vs</span>
                              <ScoreInput
                                value={scores[match.id]?.s2 ?? ""}
                                name={`grupo-${group.id}-${match.id}-p2`}
                                ariaLabel={`Score ${byId[match.pareja2Id]?.nombre ?? "pareja 2"} en grupo ${group.nombre}`}
                                disabled={readOnly || savingId === match.id}
                                onChange={(next) => {
                                  setScores((current) => ({
                                    ...current,
                                    [match.id]: { s1: current[match.id]?.s1 ?? "", s2: next },
                                  }));
                                  setMatchSaveState((current) => ({ ...current, [match.id]: "dirty" }));
                                }}
                                onBlur={() => saveOnBlur(match)}
                              />
                              <ParejaName name={byId[match.pareja2Id]?.nombre ?? "Pareja"} className="text-right" />
                              <span
                                className={`inline-flex h-10 items-center justify-center rounded-lg border px-2 text-[11px] font-bold uppercase tracking-[0.06em] ${stateStyle}`}
                              >
                                {stateLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </GroupCard>
          );
        })}
      </div>

      {ranking ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-xl font-extrabold text-[var(--text)]">Ranking</h2>
          <div className="space-y-2">
            {ranking.map((row, idx) => (
              <div
                key={row.pareja.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
              >
                <span className={`font-mono text-sm font-bold ${idx === 0 ? "text-[var(--gold)]" : "text-[var(--text-dim)]"}`}>
                  #{idx + 1}
                </span>
                <ParejaName name={row.pareja.nombre} />
                <span className="text-xs text-[var(--text-muted)]">GF {row.gf}</span>
                <span className="text-xs text-[var(--text-muted)]">GC {row.gc}</span>
                <span className="text-xs font-bold text-[var(--accent)]">Diff {row.diff}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
