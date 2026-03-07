import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { collectGroupResults } from "@/lib/tournament-service";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import { GoToBracketButton } from "@/components/tournament/GoToBracketButton";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { resolvePairDisplayName } from "@/lib/pair-utils";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function RankingPage({ params }: RouteParams) {
  const authUser = await requirePageAuth();
  const { id } = await params;
  const torneo = await db.torneo.findFirst({
    where: {
      id,
      userId: authUser.userId,
    },
    include: {
      parejas: { orderBy: { nombre: "asc" } },
      grupos: {
        include: {
          partidos: true,
        },
      },
      bracket: true,
      desempates: {
        where: { resuelto: false },
      },
    },
  });

  if (!torneo) {
    notFound();
  }

  const pairs = torneo.parejas.map((pair) => ({ id: pair.id, nombre: resolvePairDisplayName(pair) }));
  const ranking = computeRanking(pairs, collectGroupResults(torneo.grupos));
  const cuadro = getBracketSize(ranking.length);
  const byes = cuadro - ranking.length;
  const tiebreaks = detectTiebreaks(ranking, byes);
  const tiebreakPending = Boolean(tiebreaks) || torneo.desempates.length > 0;

  return (
    <section>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="hidden md:block">
          <div className="grid grid-cols-[56px_1fr_80px_80px_80px_110px] border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-dim)]">
            <span>#</span>
            <span>Pareja</span>
            <span className="text-right">GF</span>
            <span className="text-right">GC</span>
            <span className="text-right">Dif.</span>
            <span className="text-right">Estado</span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {ranking.map((row, idx) => {
              const hasBye = idx < byes;
              const diffClass =
                row.diff > 0 ? "text-[var(--green)]" : row.diff < 0 ? "text-[var(--red)]" : "text-[var(--text-dim)]";

              return (
                <div
                  key={row.pareja.id}
                  className={`grid grid-cols-[56px_1fr_80px_80px_80px_110px] items-center px-4 py-3 ${
                    hasBye ? "bg-[var(--purple)]/10" : "bg-transparent"
                  }`}
                >
                  <span className={`font-mono text-sm font-bold ${idx === 0 ? "text-[var(--gold)]" : "text-[var(--text-dim)]"}`}>
                    #{idx + 1}
                  </span>
                  <span className="truncate font-semibold text-[var(--text)]">{row.pareja.nombre}</span>
                  <span className="text-right font-mono text-sm font-bold text-[var(--green)]">{row.gf}</span>
                  <span className="text-right font-mono text-sm font-bold text-[var(--red)]">{row.gc}</span>
                  <span className={`text-right font-mono text-sm font-bold ${diffClass}`}>{row.diff}</span>
                  <div className="flex justify-end">
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                        hasBye
                          ? "border border-[var(--purple)]/70 bg-[var(--purple)]/20 text-[var(--purple)]"
                          : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                      }`}
                    >
                      {hasBye ? "BYE" : "Juega"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {ranking.map((row, idx) => {
            const hasBye = idx < byes;
            const diffClass =
              row.diff > 0 ? "text-[var(--green)]" : row.diff < 0 ? "text-[var(--red)]" : "text-[var(--text-dim)]";

            return (
              <article
                key={row.pareja.id}
                className={`rounded-xl border px-3 py-3 ${
                  hasBye ? "bg-[var(--purple)]/10" : "bg-transparent"
                } border-[var(--border)]`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={`font-mono text-sm font-bold ${idx === 0 ? "text-[var(--gold)]" : "text-[var(--text-dim)]"}`}>
                    #{idx + 1}
                  </p>
                  <p className="min-w-0 flex-1 truncate text-right font-semibold text-[var(--text)]">{row.pareja.nombre}</p>
                  <span
                    className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                      hasBye
                        ? "border border-[var(--purple)]/70 bg-[var(--purple)]/20 text-[var(--purple)]"
                        : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                    }`}
                  >
                    {hasBye ? "BYE" : "Juega"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]">GF</p>
                    <p className="font-mono text-base font-bold text-[var(--green)]">{row.gf}</p>
                  </div>
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]">GC</p>
                    <p className="font-mono text-base font-bold text-[var(--red)]">{row.gc}</p>
                  </div>
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]">Dif.</p>
                    <p className={`font-mono text-base font-bold ${diffClass}`}>{row.diff}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="grid gap-2 text-sm text-[var(--text-muted)] md:grid-cols-2">
          <p>
            Parejas: <span className="font-bold text-[var(--text)]">{ranking.length}</span>
          </p>
          <p>
            Cuadro: <span className="font-bold text-[var(--accent)]">{cuadro}</span>
          </p>
          <p>
            BYEs: <span className="font-bold text-[var(--purple)]">{byes}</span>
          </p>
          <p>
            BYE pasan a <span className="font-bold text-[var(--gold)]">{byes}</span>
          </p>
        </div>

        <div className="mt-5">
          {tiebreakPending ? (
            <Link
              href={`/torneo/${torneo.id}/desempate`}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-extrabold text-[#1f2937] transition hover:brightness-110"
            >
              Resolver Empates
            </Link>
          ) : (
            <GoToBracketButton torneoId={torneo.id} hasBracket={Boolean(torneo.bracket)} />
          )}
        </div>
      </section>
    </section>
  );
}
