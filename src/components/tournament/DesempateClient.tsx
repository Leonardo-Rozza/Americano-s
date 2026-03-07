"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

type Pair = {
  id: string;
  nombre: string;
};

type DesempateClientProps = {
  torneoId: string;
  metodo: "MONEDA" | "TIEBREAK";
  tiedPairs: Pair[];
  byeSlots: number;
  alivePairIds: string[];
  eliminatedPairIds: string[];
  currentDuel: { id: string; pareja1Id: string; pareja2Id: string } | null;
};

export function DesempateClient({
  torneoId,
  metodo,
  tiedPairs,
  byeSlots,
  alivePairIds,
  eliminatedPairIds,
  currentDuel,
}: DesempateClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);
  const [coinWinner, setCoinWinner] = useState<string | null>(null);

  const pairById = useMemo(() => Object.fromEntries(tiedPairs.map((pair) => [pair.id, pair])), [tiedPairs]);
  const aliveSet = useMemo(() => new Set(alivePairIds), [alivePairIds]);
  const eliminatedSet = useMemo(() => new Set(eliminatedPairIds), [eliminatedPairIds]);
  const current = currentDuel ? ([currentDuel.pareja1Id, currentDuel.pareja2Id] as const) : null;
  const eliminationsNeeded = Math.max(0, tiedPairs.length - byeSlots);
  const eliminationsDone = Math.min(eliminatedPairIds.length, eliminationsNeeded);
  const byeLocked = alivePairIds.length <= byeSlots;

  async function confirmWinner(winnerId: string) {
    if (!currentDuel || !current || saving || refreshing) {
      return;
    }
    const [a, b] = current;
    if (![a, b].includes(winnerId)) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/torneo/${torneoId}/desempate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desempateId: currentDuel.id,
          ganadorId: winnerId,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; data: { pending: number; complete?: boolean } }
        | { success: false; error: string };

      if (!payload.success) {
        showToast({
          message: payload.error,
          tone: "error",
          onRetry: () => {
            void confirmWinner(winnerId);
          },
        });
        return;
      }

      setCoinWinner(null);
      if (payload.data.complete || payload.data.pending === 0) {
        startTransition(() => {
          router.push(`/torneo/${torneoId}/ranking`);
          router.refresh();
        });
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      showToast({
        message: "No se pudo resolver el desempate.",
        tone: "error",
        onRetry: () => {
          void confirmWinner(winnerId);
        },
      });
    } finally {
      setSaving(false);
    }
  }

  async function tossCoin() {
    if (!current || saving || spinning) {
      return;
    }
    setSpinning(true);
    setCoinWinner(null);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const winner = Math.random() < 0.5 ? current[0] : current[1];
    setCoinWinner(winner);
    setSpinning(false);
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-3xl font-extrabold text-[var(--text)]">
          {tiedPairs.length} parejas empatadas · {byeSlots} BYE{byeSlots === 1 ? "" : "s"} disponibles
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Eliminadas: <span className="font-bold text-[var(--gold)]">{eliminationsDone}</span> / {eliminationsNeeded}
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="grid gap-2 md:grid-cols-2">
          {tiedPairs.map((pair) => {
            const isEliminated = eliminatedSet.has(pair.id);
            const isCurrent = Boolean(current && current.includes(pair.id));
            const isByeWinner = byeLocked && aliveSet.has(pair.id) && !isEliminated;
            const badge = isByeWinner
              ? "✓ BYE"
              : isEliminated
                ? "✗ eliminada"
                : isCurrent
                  ? "duelo actual"
                  : "en disputa";
            const badgeClass = isByeWinner
              ? "border-[var(--green)]/70 bg-[var(--green)]/15 text-[var(--green)]"
              : isEliminated
                ? "border-[var(--red)]/70 bg-[var(--red)]/15 text-[var(--red)]"
                : isCurrent
                  ? "border-[var(--gold)]/70 bg-[var(--gold)]/20 text-[var(--gold)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]";

            return (
              <div key={pair.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <span className="font-semibold text-[var(--text)]">{pair.nombre}</span>
                <span className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] ${badgeClass}`}>
                  {badge}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {current ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">Duelo actual</p>
          <div className="mb-6 flex items-center justify-center gap-4 text-center">
            <span className="max-w-40 truncate text-xl font-extrabold text-[var(--text)]">{pairById[current[0]]?.nombre}</span>
            <span className="text-xl font-black text-[var(--gold)]">vs</span>
            <span className="max-w-40 truncate text-xl font-extrabold text-[var(--text)]">{pairById[current[1]]?.nombre}</span>
          </div>

          {metodo === "MONEDA" ? (
            <div className="flex flex-col items-center gap-4">
              <div
                className={`coin h-20 w-20 rounded-full border border-[var(--gold)]/70 ${
                  spinning ? "coin-spinning" : coinWinner ? "coin-done" : ""
                }`}
              >
                {coinWinner ? "✓" : "🪙"}
              </div>

              {!coinWinner ? (
                <button
                  onClick={tossCoin}
                  disabled={saving || spinning || refreshing}
                  className="h-11 rounded-xl border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-extrabold text-[#1f2937] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {spinning ? "Girando…" : "Tirar moneda"}
                </button>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="text-sm font-semibold text-[var(--green)]">
                    Gana {pairById[coinWinner]?.nombre}
                  </p>
                  <button
                    onClick={() => confirmWinner(coinWinner)}
                    disabled={saving || refreshing}
                    className="h-11 rounded-xl border border-[var(--green)] bg-[var(--green)] px-4 text-sm font-extrabold text-[#052e2b] transition hover:brightness-110 disabled:opacity-60"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {current.map((id) => (
                <button
                  key={id}
                  onClick={() => confirmWinner(id)}
                  disabled={saving || refreshing}
                  className="h-12 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 px-4 text-sm font-extrabold text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/25 disabled:opacity-60"
                >
                  {pairById[id]?.nombre}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-sm text-[var(--text-muted)]">No hay duelo activo. Recargá para sincronizar el estado.</p>
          <button
            onClick={() => router.refresh()}
            className="mt-3 h-10 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 px-4 text-sm font-extrabold text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/25"
          >
            Recargar
          </button>
        </section>
      )}

    </section>
  );
}
