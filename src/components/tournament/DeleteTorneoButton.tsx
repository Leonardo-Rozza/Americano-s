"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type DeleteTorneoButtonProps = {
  torneoId: string;
  torneoNombre: string;
};

export function DeleteTorneoButton({ torneoId, torneoNombre }: DeleteTorneoButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(`Eliminar torneo "${torneoNombre}"? Esta accion no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/torneo/${torneoId}`, {
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
            void handleDelete();
          },
        });
        return;
      }

      showToast({ message: "Torneo eliminado.", tone: "success" });
      router.refresh();
    } catch {
      showToast({
        message: "No se pudo eliminar el torneo.",
        tone: "error",
        onRetry: () => {
          void handleDelete();
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-[var(--red)]/60 bg-[var(--red)]/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--red)] transition hover:bg-[var(--red)]/20 disabled:opacity-60"
    >
      {loading ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
