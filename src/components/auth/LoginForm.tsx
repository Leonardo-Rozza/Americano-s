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
  const [showPassword, setShowPassword] = useState(false);
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
        if (response.status === 401) {
          setError("Usuario o contraseña inválidos.");
        } else if (response.status === 400) {
          setError(payload.error || "Revisá los datos ingresados.");
        } else {
          setError("No se pudo iniciar sesión. Intentá nuevamente.");
        }
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
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={submitting}
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 pr-12 text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-70"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={submitting}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
                <path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c5.05 0 9.27 3.11 10.5 7.1a11.96 11.96 0 0 1-4.16 5.94" />
                <path d="M6.53 6.53A12.38 12.38 0 0 0 1.5 12c1.23 3.99 5.45 7.1 10.5 7.1 1.68 0 3.28-.35 4.72-.98" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1.5 12c1.23-3.99 5.45-7.1 10.5-7.1s9.27 3.11 10.5 7.1c-1.23 3.99-5.45 7.1-10.5 7.1S2.73 15.99 1.5 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
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
