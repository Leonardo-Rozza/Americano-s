"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { authFetch } from "@/lib/auth/auth-fetch";

type TiedPair = {
  id: string;
  nombre: string;
  gf: number;
  gc: number;
  diff: number;
};

type Method = "moneda" | "tiebreak" | "manual";
type Phase = "choose" | "coin-spin" | "coin-result" | "select";

type Props = {
  torneoId: string;
  tiedPairs: TiedPair[];
  byeSlots: number;
};

export function DesempateClient({ torneoId, tiedPairs, byeSlots }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<Phase>("choose");
  const [method, setMethod] = useState<Method | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [byeWinnerIds, setByeWinnerIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function tossCoin(chosenMethod: Method) {
    setMethod(chosenMethod);
    setPhase("coin-spin");
    setSpinning(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Sortea exactamente los BYEs disputados (defensivo ante cualquier edge-case).
    const shuffled = [...tiedPairs].sort(() => Math.random() - 0.5);
    setByeWinnerIds(shuffled.slice(0, byeSlots).map((p) => p.id));

    setSpinning(false);
    setPhase("coin-result");
  }

  function selectMethod(chosenMethod: Method) {
    setMethod(chosenMethod);
    if (chosenMethod === "moneda") {
      void tossCoin(chosenMethod);
    } else {
      setSelectedIds(new Set());
      setPhase("select");
    }
  }

  function togglePair(pairId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pairId)) {
        next.delete(pairId);
      } else if (next.size < byeSlots) {
        next.add(pairId);
      }
      return next;
    });
  }

  function confirmSelection() {
    setByeWinnerIds([...selectedIds]);
    setPhase("coin-result");
  }

  async function submit(winners: string[]) {
    setSaving(true);
    try {
      const response = await authFetch(`/api/torneo/${torneoId}/desempate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, byeWinnerIds: winners }),
      });
      const payload = (await response.json()) as
        | { success: true; data: unknown }
        | { success: false; error: string };

      if (!payload.success) {
        showToast({ message: payload.error, tone: "error" });
        return;
      }

      startTransition(() => {
        router.push(`/torneo/${torneoId}/ranking`);
        router.refresh();
      });
    } catch {
      showToast({ message: "No se pudo resolver el desempate.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const winnerSet = new Set(byeWinnerIds);

  if (phase === "choose") {
    return (
      <section className="space-y-5">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">Desempate por BYE</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {tiedPairs.length} parejas empatadas · {byeSlots} BYE{byeSlots === 1 ? "" : "s"} disponible{byeSlots === 1 ? "" : "s"}
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="grid grid-cols-[1fr_64px_64px_64px] border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-dim)]">
            <span>Pareja</span>
            <span className="text-right">GF</span>
            <span className="text-right">GC</span>
            <span className="text-right">Dif.</span>
          </div>
          {tiedPairs.map((pair) => (
            <div key={pair.id} className="grid grid-cols-[1fr_64px_64px_64px] items-center border-b border-[var(--border)] px-4 py-3 last:border-0">
              <span className="font-semibold text-[var(--text)]">{pair.nombre}</span>
              <span className="text-right font-mono text-sm font-bold text-[var(--green)]">{pair.gf}</span>
              <span className="text-right font-mono text-sm font-bold text-[var(--red)]">{pair.gc}</span>
              <span className="text-right font-mono text-sm font-bold text-[var(--text-muted)]">{pair.diff}</span>
            </div>
          ))}
        </section>

        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Elegir metodo de desempate
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => selectMethod("moneda")}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--gold)] hover:bg-[var(--gold)]/5"
          >
            <div className="mb-3 text-3xl">🪙</div>
            <p className="font-extrabold text-[var(--text)]">Sorteo automatico</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">La app sortea al azar quien recibe BYE</p>
          </button>
          <button
            onClick={() => selectMethod("tiebreak")}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
          >
            <div className="mb-3 text-3xl">🎾</div>
            <p className="font-extrabold text-[var(--text)]">Tie-break en cancha</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Jugaron en cancha, selecciona quien gano</p>
          </button>
          <button
            onClick={() => selectMethod("manual")}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--purple)] hover:bg-[var(--purple)]/5"
          >
            <div className="mb-3 text-3xl">✏️</div>
            <p className="font-extrabold text-[var(--text)]">Decision del organizador</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Elegis manualmente quien recibe BYE</p>
          </button>
        </div>
      </section>
    );
  }

  if (phase === "coin-spin") {
    return (
      <section className="space-y-5">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">Sorteando BYE{byeSlots === 1 ? "" : "s"}…</h1>
        </header>
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10">
          <div className="coin coin-spinning h-20 w-20 rounded-full border-2 border-[var(--gold)]/70">
            🪙
          </div>
          <p className="text-sm text-[var(--text-muted)]">Girando…</p>
        </div>
      </section>
    );
  }

  if (phase === "select") {
    const canConfirm = selectedIds.size === byeSlots;
    return (
      <section className="space-y-5">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">
            {method === "tiebreak" ? "Tie-break en cancha" : "Decision del organizador"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Selecciona exactamente {byeSlots} pareja{byeSlots === 1 ? "" : "s"} que recibe{byeSlots === 1 ? "" : "n"} BYE
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="space-y-2">
            {tiedPairs.map((pair) => {
              const selected = selectedIds.has(pair.id);
              const disabled = !selected && selectedIds.size >= byeSlots;
              return (
                <button
                  key={pair.id}
                  onClick={() => !disabled && togglePair(pair.id)}
                  disabled={disabled}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[var(--green)] bg-[var(--green)]/15 text-[var(--text)]"
                      : disabled
                        ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] opacity-40"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)]"
                  }`}
                >
                  <span className="font-semibold">{pair.nombre}</span>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                      selected
                        ? "border-[var(--green)]/70 bg-[var(--green)]/20 text-[var(--green)]"
                        : "border-[var(--border)] text-[var(--text-dim)]"
                    }`}
                  >
                    {selected ? "BYE" : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Seleccionadas: {selectedIds.size} / {byeSlots}
          </p>
        </section>

        <div className="flex gap-3">
          <button
            onClick={() => { setPhase("choose"); setMethod(null); }}
            className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-bold text-[var(--text-muted)] transition hover:border-[var(--accent)]"
          >
            Volver
          </button>
          <button
            onClick={confirmSelection}
            disabled={!canConfirm}
            className="h-11 flex-1 rounded-xl border border-[var(--accent)] bg-[var(--accent)] text-sm font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ver resultado
          </button>
        </div>
      </section>
    );
  }

  // phase === "coin-result"
  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-2xl font-extrabold text-[var(--text)]">Resultado del desempate</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {method === "moneda" ? "Sorteo automatico" : method === "tiebreak" ? "Tie-break en cancha" : "Decision del organizador"}
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {method === "moneda" && byeWinnerIds.length === 1 ? (
          <div className="mb-4 flex flex-col items-center gap-3">
            <div className="coin coin-done h-20 w-20 rounded-full border-2 border-[var(--green)]/70">✓</div>
            <p className="text-sm font-semibold text-[var(--green)]">
              Gana {tiedPairs.find((p) => winnerSet.has(p.id))?.nombre}
            </p>
          </div>
        ) : method === "moneda" ? (
          <div className="mb-4 flex flex-col items-center gap-3">
            <div className="coin coin-done h-20 w-20 rounded-full border-2 border-[var(--green)]/70">✓</div>
          </div>
        ) : null}

        <div className="space-y-2">
          {tiedPairs.map((pair) => {
            const isByeWinner = winnerSet.has(pair.id);
            return (
              <div
                key={pair.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isByeWinner
                    ? "border-[var(--green)]/50 bg-[var(--green)]/10"
                    : "border-[var(--border)] bg-[var(--surface-2)]"
                }`}
              >
                <span className="font-semibold text-[var(--text)]">{pair.nombre}</span>
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                    isByeWinner
                      ? "border-[var(--green)]/70 bg-[var(--green)]/20 text-[var(--green)]"
                      : "border-[var(--red)]/70 bg-[var(--red)]/15 text-[var(--red)]"
                  }`}
                >
                  {isByeWinner ? "✓ BYE" : "✗ Juega"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3">
        <button
          onClick={() => { setPhase("choose"); setMethod(null); setByeWinnerIds([]); }}
          disabled={saving}
          className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-bold text-[var(--text-muted)] transition hover:border-[var(--accent)] disabled:opacity-60"
        >
          Volver
        </button>
        <button
          onClick={() => submit(byeWinnerIds)}
          disabled={saving}
          className="h-11 flex-1 rounded-xl border border-[var(--accent)] bg-[var(--accent)] text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Generar cuadro eliminatorio →"}
        </button>
      </div>
    </section>
  );
}
