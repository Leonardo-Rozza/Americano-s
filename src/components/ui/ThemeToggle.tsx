"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/hooks/useTheme";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const nextLabel = !mounted
    ? "Cambiar tema"
    : theme === "dark"
      ? "Cambiar a tema claro"
      : "Cambiar a tema oscuro";
  const icon = !mounted ? "◐" : theme === "dark" ? "☀️" : "🌙";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className="fixed right-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-base text-[var(--text)] shadow-[var(--shadow-card)] transition hover:border-[var(--border-light)] hover:bg-[var(--surface-2)]"
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}
