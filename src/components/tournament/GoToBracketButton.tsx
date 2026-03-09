"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";

type GoToBracketButtonProps = {
  torneoId: string;
  hasBracket: boolean;
  className?: string;
};

export function GoToBracketButton({ torneoId, hasBracket, className }: GoToBracketButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (hasBracket) {
      router.push(`/torneo/${torneoId}/bracket`);
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch(`/api/torneo/${torneoId}/bracket`, {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { success: true; data: unknown }
        | { success: false; error: string };

      if (!payload.success) {
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void handleClick();
          },
        });
        return;
      }
      router.push(`/torneo/${torneoId}/bracket`);
    } catch {
      showToast({
        message: "No se pudo generar el bracket.",
        tone: "error",
        onRetry: () => {
          void handleClick();
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`btn-primary h-11 rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      >
        {loading ? "Generando…" : "Ver Cuadro Eliminatorio"}
      </button>
    </div>
  );
}
