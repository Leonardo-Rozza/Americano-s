"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";

type DeleteTorneoButtonProps = {
  torneoId: string;
  torneoNombre: string;
};

export function DeleteTorneoButton({ torneoId, torneoNombre }: DeleteTorneoButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function confirmDelete() {
    setLoading(true);
    try {
      const response = await authFetch(`/api/torneo/${torneoId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as
        | { success: true; data: { deleted: boolean } }
        | { success: false; error: string };

      if (!payload.success) {
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void confirmDelete();
          },
        });
        return;
      }

      showToast({ message: "Torneo eliminado.", tone: "success" });
      setConfirmOpen(false);
      router.refresh();
    } catch {
      showToast({
        message: "No se pudo eliminar el torneo.",
        tone: "error",
        onRetry: () => {
          void confirmDelete();
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="rounded-lg border border-[var(--red)]/60 bg-[var(--red)]/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--red)] transition hover:bg-[var(--red)]/20 disabled:opacity-60"
      >
        {loading ? "Eliminando…" : "Eliminar"}
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080f]/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Confirmar eliminacion de ${torneoNombre}`}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <p className="text-lg font-extrabold text-[var(--text)]">Eliminar torneo</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Vas a eliminar <span className="font-semibold text-[var(--text)]">{torneoNombre}</span>. Esta accion no se puede deshacer.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-bold text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmDelete();
                }}
                disabled={loading}
                className="flex-1 rounded-lg border border-[var(--red)] bg-[var(--red)] px-3 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
