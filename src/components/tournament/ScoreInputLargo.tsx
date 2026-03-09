"use client";

import {
  evaluatePadelLargoDraft,
  getPadelLargoMatchStats,
  type PadelLargoScoreDraft,
} from "@/lib/tournament-engine/scoring/padel-largo";

type ScoreInputLargoProps = {
  draft: PadelLargoScoreDraft;
  onChange: (next: PadelLargoScoreDraft) => void;
  allowSuperTiebreakThirdSet: boolean;
  leftLabel?: string;
  rightLabel?: string;
  disabled?: boolean;
  onBlur?: () => void;
};

type DraftKey = keyof PadelLargoScoreDraft;

function parseSetWinner(p1Raw: string, p2Raw: string): "p1" | "p2" | null {
  if (!/^\d{1,2}$/.test(p1Raw) || !/^\d{1,2}$/.test(p2Raw)) {
    return null;
  }
  const p1 = Number(p1Raw);
  const p2 = Number(p2Raw);
  if (p1 === p2) {
    return null;
  }
  return p1 > p2 ? "p1" : "p2";
}

function normalizeNumericInput(raw: string, maxDigits: number, maxValue: number): string {
  const clean = raw.replace(/\D/g, "").slice(0, maxDigits);
  if (clean.length === 0) {
    return "";
  }
  const numeric = Number(clean);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  if (numeric > maxValue) {
    return String(maxValue);
  }
  return String(numeric);
}

export function ScoreInputLargo({
  draft,
  onChange,
  allowSuperTiebreakThirdSet,
  leftLabel = "Pareja A",
  rightLabel = "Pareja B",
  disabled,
  onBlur,
}: ScoreInputLargoProps) {
  const set1Winner = parseSetWinner(draft.set1P1, draft.set1P2);
  const set2Winner = parseSetWinner(draft.set2P1, draft.set2P2);
  const splitAfterTwo = Boolean(set1Winner && set2Winner && set1Winner !== set2Winner);
  const hasThirdSetDraft = draft.set3P1.length > 0 || draft.set3P2.length > 0;
  const showThirdSet = splitAfterTwo || hasThirdSetDraft;

  const evaluation = evaluatePadelLargoDraft(draft, {
    allowSuperTiebreakThirdSet,
  });
  const invalid = evaluation.status === "invalid";

  let resultText: string | null = null;
  if (evaluation.status === "valid") {
    const stats = getPadelLargoMatchStats(evaluation.score);
    const winnerLabel = evaluation.winner === "p1" ? leftLabel : rightLabel;
    resultText = `Resultado: ${winnerLabel} gana ${stats.setsP1}-${stats.setsP2}`;
  }

  function updateCell(key: DraftKey, raw: string, maxDigits: number, maxValue: number) {
    const nextValue = normalizeNumericInput(raw, maxDigits, maxValue);
    onChange({
      ...draft,
      [key]: nextValue,
    });
  }

  const thirdSetDigits = allowSuperTiebreakThirdSet ? 2 : 1;
  const thirdSetMax = allowSuperTiebreakThirdSet ? 99 : 7;

  const sharedInputClass = `h-9 w-12 rounded-md border text-center font-mono text-sm font-bold outline-none transition ${
    invalid
      ? "border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)] focus-visible:ring-[var(--red)]/30"
      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus-visible:border-[var(--accent)] focus-visible:ring-[var(--accent)]/30"
  } focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60`;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">Set</span>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">1</span>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">2</span>
        {showThirdSet ? (
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">3</span>
        ) : (
          <span />
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
        <span className="truncate text-sm font-semibold text-[var(--text)]">{leftLabel}</span>
        <input
          value={draft.set1P1}
          disabled={disabled}
          className={sharedInputClass}
          onBlur={onBlur}
          onChange={(event) => updateCell("set1P1", event.target.value, 1, 7)}
        />
        <input
          value={draft.set2P1}
          disabled={disabled}
          className={sharedInputClass}
          onBlur={onBlur}
          onChange={(event) => updateCell("set2P1", event.target.value, 1, 7)}
        />
        {showThirdSet ? (
          <input
            value={draft.set3P1}
            disabled={disabled}
            className={sharedInputClass}
            onBlur={onBlur}
            onChange={(event) =>
              updateCell("set3P1", event.target.value, thirdSetDigits, thirdSetMax)
            }
          />
        ) : (
          <span />
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
        <span className="truncate text-sm font-semibold text-[var(--text)]">{rightLabel}</span>
        <input
          value={draft.set1P2}
          disabled={disabled}
          className={sharedInputClass}
          onBlur={onBlur}
          onChange={(event) => updateCell("set1P2", event.target.value, 1, 7)}
        />
        <input
          value={draft.set2P2}
          disabled={disabled}
          className={sharedInputClass}
          onBlur={onBlur}
          onChange={(event) => updateCell("set2P2", event.target.value, 1, 7)}
        />
        {showThirdSet ? (
          <input
            value={draft.set3P2}
            disabled={disabled}
            className={sharedInputClass}
            onBlur={onBlur}
            onChange={(event) =>
              updateCell("set3P2", event.target.value, thirdSetDigits, thirdSetMax)
            }
          />
        ) : (
          <span />
        )}
      </div>

      {invalid ? (
        <p className="text-xs font-semibold text-[var(--red)]" title={evaluation.message}>
          {evaluation.message}
        </p>
      ) : null}
      {resultText ? <p className="text-xs font-semibold text-[var(--green)]">{resultText}</p> : null}
      {showThirdSet && allowSuperTiebreakThirdSet ? (
        <p className="text-[11px] text-[var(--text-dim)]">
          Tercer set en super tie-break (a 10 con diferencia de 2).
        </p>
      ) : null}
    </div>
  );
}
