import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import { GoToBracketButton } from "@/components/tournament/GoToBracketButton";
import { TorneoHeader } from "@/components/tournament/TorneoHeader";
import { requirePageAuth } from "@/lib/auth/require-auth";
import {
  buildAmericanoRankingSnapshot,
  buildLargoRankingSnapshot,
  toTournamentHeaderProps,
} from "@/lib/tournament-view";

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
      _count: {
        select: { parejas: true },
      },
      parejas: { orderBy: { nombre: "asc" } },
      grupos: {
        include: {
          parejas: { orderBy: { nombre: "asc" } },
          partidos: true,
        },
      },
      bracket: true,
      desempates: { orderBy: { id: "asc" } },
    },
  });

  if (!torneo) {
    notFound();
  }

  if (torneo.formato === "LARGO" && torneo.deporte === "PADEL") {
    const largoRanking = buildLargoRankingSnapshot({
      grupos: torneo.grupos,
      config: torneo.config,
    });
    const classifiedSet = new Set(largoRanking.classified.map((item) => item.pareja.id));

    return (
      <section className="space-y-5">
        <TorneoHeader {...toTournamentHeaderProps(torneo)} />

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="text-2xl font-extrabold text-[var(--text)]">Ranking por zonas · Largo</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Clasifican top {largoRanking.qualifiersByGroupSize["4"]} en zonas de 4 y top {largoRanking.qualifiersByGroupSize["3"]} en zonas de 3.
          </p>
        </section>

        <div className="grid gap-4">
          {largoRanking.groupRankings.map((group) => (
            <section key={group.groupId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="mb-3 text-lg font-extrabold text-[var(--text)]">Zona {group.groupName}</h2>

              <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
                <div className="grid grid-cols-[44px_1fr_52px_52px_52px_60px_88px_92px_110px] bg-[var(--surface-2)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-dim)]">
                  <span>#</span>
                  <span>Pareja</span>
                  <span className="text-right">PJ</span>
                  <span className="text-right">PG</span>
                  <span className="text-right">PP</span>
                  <span className="text-right">Pts</span>
                  <span className="text-right">Sets +/-</span>
                  <span className="text-right">Games +/-</span>
                  <span className="text-right">Estado</span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {group.rows.map((row, idx) => {
                    const isClassified = classifiedSet.has(row.pareja.id);
                    return (
                      <div
                        key={row.pareja.id}
                        className="grid grid-cols-[44px_1fr_52px_52px_52px_60px_88px_92px_110px] items-center px-3 py-2 text-sm"
                      >
                        <span className="font-mono font-bold text-[var(--text-dim)]">#{idx + 1}</span>
                        <span className="truncate font-semibold text-[var(--text)]">{row.pareja.nombre}</span>
                        <span className="text-right font-mono text-[var(--text-muted)]">{row.pj}</span>
                        <span className="text-right font-mono text-[var(--green)]">{row.pg}</span>
                        <span className="text-right font-mono text-[var(--red)]">{row.pp}</span>
                        <span className="text-right font-mono font-bold text-[var(--accent)]">{row.puntos}</span>
                        <span className="text-right font-mono text-[var(--text-muted)]">
                          {row.setsDiff > 0 ? `+${row.setsDiff}` : row.setsDiff}
                        </span>
                        <span className="text-right font-mono text-[var(--text-muted)]">
                          {row.gamesDiff > 0 ? `+${row.gamesDiff}` : row.gamesDiff}
                        </span>
                        <div className="flex justify-end">
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              isClassified
                                ? "border border-[var(--green)]/60 bg-[var(--green)]/15 text-[var(--green)]"
                                : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)]"
                            }`}
                          >
                            {isClassified ? "Clasifica" : "Eliminado"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 md:hidden">
                {group.rows.map((row, idx) => {
                  const isClassified = classifiedSet.has(row.pareja.id);
                  return (
                    <article key={row.pareja.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-[var(--text-dim)]">#{idx + 1}</p>
                        <p className="min-w-0 flex-1 truncate text-right font-semibold text-[var(--text)]">{row.pareja.nombre}</p>
                        <span
                          className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                            isClassified
                              ? "border border-[var(--green)]/60 bg-[var(--green)]/15 text-[var(--green)]"
                              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]"
                          }`}
                        >
                          {isClassified ? "Clasifica" : "Eliminado"}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-dim)]">PJ</p>
                          <p className="font-mono font-bold text-[var(--text)]">{row.pj}</p>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-dim)]">Pts</p>
                          <p className="font-mono font-bold text-[var(--accent)]">{row.puntos}</p>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-dim)]">Sets</p>
                          <p className="font-mono font-bold text-[var(--text)]">
                            {row.setsDiff > 0 ? `+${row.setsDiff}` : row.setsDiff}
                          </p>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-dim)]">Games</p>
                          <p className="font-mono font-bold text-[var(--text)]">
                            {row.gamesDiff > 0 ? `+${row.gamesDiff}` : row.gamesDiff}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="grid gap-2 text-sm text-[var(--text-muted)] md:grid-cols-2">
            <p>
              Clasificados: <span className="font-bold text-[var(--green)]">{largoRanking.classified.length}</span>
            </p>
            <p>
              Cuadro: <span className="font-bold text-[var(--accent)]">{getBracketSize(largoRanking.classified.length)}</span>
            </p>
          </div>
          <div className="mt-4">
            <GoToBracketButton torneoId={torneo.id} hasBracket={Boolean(torneo.bracket)} />
          </div>
        </section>
      </section>
    );
  }

  const rankingSnapshot = buildAmericanoRankingSnapshot({
    parejas: torneo.parejas,
    grupos: torneo.grupos,
    desempates: torneo.desempates,
  });
  const rankingRows = rankingSnapshot.tiebreakResolution?.ranking ?? rankingSnapshot.ranking;
  const tiebreakPending = rankingSnapshot.tiebreakResolution?.tiebreakPending ?? false;

  return (
    <section>
      <TorneoHeader {...toTournamentHeaderProps(torneo)} />

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
            {rankingRows.map((row, idx) => {
              const hasBye = idx < rankingSnapshot.byes;
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
          {rankingRows.map((row, idx) => {
            const hasBye = idx < rankingSnapshot.byes;
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
            Parejas: <span className="font-bold text-[var(--text)]">{rankingSnapshot.ranking.length}</span>
          </p>
          <p>
            Cuadro: <span className="font-bold text-[var(--accent)]">{rankingSnapshot.bracketSize}</span>
          </p>
          <p>
            BYEs: <span className="font-bold text-[var(--purple)]">{rankingSnapshot.byes}</span>
          </p>
          <p>
            BYE pasan a <span className="font-bold text-[var(--gold)]">{rankingSnapshot.byes}</span>
          </p>
        </div>

        <div className="mt-5">
          {tiebreakPending ? (
            <Link
              href={`/torneo/${torneo.id}/desempate`}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--gold)] bg-[var(--gold)] px-4 text-sm font-extrabold text-[var(--text-on-gold)] transition hover:brightness-110"
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
