"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; data: { user: { id: string; username: string } } }
        | { success: false; error: string };

      if (!payload.success) {
        setError(payload.error);
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="username" className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          disabled={submitting}
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-70"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={submitting}
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-70"
        />
      </div>

      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
