"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

type Pair = {
  id: string;
  nombre: string;
};

type DesempateRecord = {
  id: string;
  pareja1Id: string;
  pareja2Id: string;
};

type DesempateClientProps = {
  torneoId: string;
  metodo: "MONEDA" | "TIEBREAK";
  tiedPairs: Pair[];
  byeSlots: number;
  pendingRecords: DesempateRecord[];
};

function keyForPair(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function DesempateClient({ torneoId, metodo, tiedPairs, byeSlots, pendingRecords }: DesempateClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pool, setPool] = useState(tiedPairs.map((pair) => pair.id));
  const [byeWinners, setByeWinners] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [coinWinner, setCoinWinner] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const pairById = useMemo(() => Object.fromEntries(tiedPairs.map((pair) => [pair.id, pair])), [tiedPairs]);
  const pendingByPair = useMemo(
    () =>
      Object.fromEntries(
        pendingRecords.map((item) => [keyForPair(item.pareja1Id, item.pareja2Id), item.id]),
      ) as Record<string, string>,
    [pendingRecords],
  );

  const current = pool.length >= 2 ? [pool[0], pool[1]] : null;
  const byesAssigned = byeWinners.length;
  const noByeSet = new Set(
    finished ? tiedPairs.map((pair) => pair.id).filter((id) => !byeWinners.includes(id)) : [],
  );

  async function confirmWinner(winnerId: string) {
    if (!current || saving || finished) {
      return;
    }
    const [a, b] = current;
    if (![a, b].includes(winnerId)) {
      return;
    }
    const loserId = winnerId === a ? b : a;
    const willFinish = byesAssigned + 1 >= byeSlots;
    const desempateId = pendingByPair[keyForPair(a, b)];

    setSaving(true);

    try {
      const response = await fetch(`/api/torneo/${torneoId}/desempate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(desempateId ? { desempateId } : { pareja1Id: a, pareja2Id: b }),
          ganadorId: winnerId,
          finalizar: willFinish,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; data: unknown }
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

      setByeWinners((currentWinners) => [...currentWinners, winnerId]);
      setPool((currentPool) => {
        const rest = currentPool.slice(2);
        return [...rest, loserId];
      });

      setCoinWinner(null);

      if (willFinish) {
        setFinished(true);
        router.push(`/torneo/${torneoId}/ranking`);
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
          {tiedPairs.length} parejas empatadas · {byeSlots} BYEs disponibles
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          BYEs asignados:{" "}
          <span className="font-bold text-[var(--gold)]">
            {byesAssigned} / {byeSlots}
          </span>
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="grid gap-2 md:grid-cols-2">
          {tiedPairs.map((pair) => {
            const inBye = byeWinners.includes(pair.id);
            const isNoBye = noByeSet.has(pair.id);
            const badge = inBye ? "✓ BYE" : isNoBye ? "✗ no BYE" : "pendiente";
            const badgeClass = inBye
              ? "border-[var(--green)]/70 bg-[var(--green)]/15 text-[var(--green)]"
              : isNoBye
                ? "border-[var(--red)]/70 bg-[var(--red)]/15 text-[var(--red)]"
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
                  disabled={saving || spinning}
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
                    disabled={saving}
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
                  disabled={saving}
                  className="h-12 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 px-4 text-sm font-extrabold text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/25 disabled:opacity-60"
                >
                  {pairById[id]?.nombre}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

    </section>
  );
}
