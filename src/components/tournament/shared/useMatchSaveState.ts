"use client";

import { useState } from "react";

export type MatchSaveState = "idle" | "dirty" | "saving" | "saved" | "error";
export type MatchSaveStateMap = Record<string, MatchSaveState>;

type SaveableMatch = {
  id: string;
  completado: boolean;
};

function buildInitialMatchSaveState(matches: SaveableMatch[]): MatchSaveStateMap {
  const output: MatchSaveStateMap = {};
  for (const match of matches) {
    output[match.id] = match.completado ? "saved" : "idle";
  }
  return output;
}

export function useMatchSaveState(matches: SaveableMatch[]) {
  const [matchSaveState, setMatchSaveState] = useState<MatchSaveStateMap>(() =>
    buildInitialMatchSaveState(matches),
  );

  return {
    matchSaveState,
    setMatchSaveState,
  };
}

export function getMatchSavePresentation(readOnly: boolean, state: MatchSaveState) {
  if (readOnly) {
    return {
      label: state === "saved" ? "Final" : "Pendiente",
      className: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
    };
  }

  if (state === "saving") {
    return {
      label: "Guardando…",
      className: "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--accent)]",
    };
  }

  if (state === "saved") {
    return {
      label: "Guardado",
      className: "border-[var(--green)]/60 bg-[var(--green)]/15 text-[var(--green)]",
    };
  }

  if (state === "error") {
    return {
      label: "Error",
      className: "border-[var(--red)]/60 bg-[var(--red)]/15 text-[var(--red)]",
    };
  }

  if (state === "dirty") {
    return {
      label: "Sin guardar",
      className: "border-[var(--gold)]/60 bg-[var(--gold)]/15 text-[var(--gold)]",
    };
  }

  return {
    label: "Pendiente",
    className: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]",
  };
}
