"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = {
  id: string;
  message: string;
  tone?: "error" | "info" | "success";
  retryLabel?: string;
  onRetry?: () => void;
};

type ToastInput = Omit<Toast, "id">;

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, ...input }]);
      window.setTimeout(() => removeToast(id), 5000);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-3 py-3 ${
              toast.tone === "error"
                ? "border-[var(--red)]/60 bg-[#2a1014] text-[var(--text)]"
                : toast.tone === "success"
                  ? "border-[var(--green)]/60 bg-[#08251f] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            <p className="text-sm font-semibold">{toast.message}</p>
            {toast.onRetry ? (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    toast.onRetry?.();
                    removeToast(toast.id);
                  }}
                  className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2 py-1 text-xs font-bold text-white"
                >
                  {toast.retryLabel ?? "Reintentar"}
                </button>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]"
                >
                  Cerrar
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
