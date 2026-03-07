import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { collectGroupResults, resolveRankingWithTiebreak } from "@/lib/tournament-service";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import { DesempateClient } from "@/components/tournament/DesempateClient";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { resolvePairDisplayName } from "@/lib/pair-utils";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function DesempatePage({ params }: RouteParams) {
  const authUser = await requirePageAuth();
  const { id } = await params;
  const torneo = await db.torneo.findFirst({
    where: {
      id,
      userId: authUser.userId,
    },
    include: {
      parejas: true,
      grupos: {
        include: {
          partidos: true,
        },
      },
      desempates: { orderBy: { id: "asc" } },
    },
  });

  if (!torneo) {
    notFound();
  }

  const pairs = torneo.parejas.map((pair) => ({ id: pair.id, nombre: resolvePairDisplayName(pair) }));
  const ranking = computeRanking(pairs, collectGroupResults(torneo.grupos));
  const byes = getBracketSize(pairs.length) - pairs.length;
  const tiebreaks = detectTiebreaks(ranking, byes);
  const tiebreakResolution = resolveRankingWithTiebreak(ranking, tiebreaks, torneo.desempates);
  const progress = tiebreakResolution.tiebreakProgress;

  if (!progress || progress.complete || !tiebreaks || tiebreaks.parejas.length < 2) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h1 className="text-2xl font-extrabold text-[var(--text)]">No hay desempates pendientes</h1>
      </section>
    );
  }

  return (
    <section>
      <DesempateClient
        torneoId={id}
        metodo={torneo.metodoDesempate}
        tiedPairs={tiebreaks.parejas}
        byeSlots={progress.byeSlotsInDispute}
        alivePairIds={progress.aliveIds}
        eliminatedPairIds={progress.eliminatedIds}
        currentDuel={progress.currentDuel}
      />
    </section>
  );
}
