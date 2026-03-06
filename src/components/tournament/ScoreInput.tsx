"use client";

type ScoreInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  onBlur?: () => void;
  name?: string;
};

export function ScoreInput({ value, onChange, disabled, ariaLabel, onBlur, name }: ScoreInputProps) {
  function setDelta(delta: number) {
    const current = Number(value);
    const base = Number.isInteger(current) ? current : 0;
    const next = Math.max(0, Math.min(6, base + delta));
    onChange(String(next));
  }

  return (
    <input
      value={value}
      aria-label={ariaLabel}
      name={name}
      disabled={disabled}
      type="text"
      inputMode="numeric"
      pattern="[0-6]"
      autoComplete="new-password"
      autoCorrect="off"
      spellCheck={false}
      maxLength={1}
      className="h-10 w-10 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-center font-mono text-lg font-bold text-[var(--text)] outline-none transition focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-60"
      onFocus={(event) => {
        event.currentTarget.select();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setDelta(1);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setDelta(-1);
        }
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/\D/g, "").slice(0, 1);
        if (raw !== "" && Number(raw) > 6) {
          return;
        }
        onChange(raw);
      }}
      onBlur={onBlur}
    />
  );
}
