import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DesempateClient } from "@/components/tournament/DesempateClient";
import { TorneoHeader } from "@/components/tournament/TorneoHeader";
import { requirePageAuth } from "@/lib/auth/require-auth";
import { buildAmericanoRankingSnapshot, toTournamentHeaderProps } from "@/lib/tournament-view";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function DesempatePage({ params }: RouteParams) {
  const authUser = await requirePageAuth();
  const { id } = await params;
  const torneo = await db.torneo.findFirst({
    where: { id, userId: authUser.userId },
    include: {
      _count: {
        select: { parejas: true },
      },
      parejas: true,
      grupos: { include: { partidos: true } },
    },
  });

  if (!torneo) {
    notFound();
  }

  const rankingSnapshot = buildAmericanoRankingSnapshot({
    parejas: torneo.parejas,
    grupos: torneo.grupos,
  });
  const ranking = rankingSnapshot.ranking;
  const tiebreaks = rankingSnapshot.tiebreaks;

  if (!tiebreaks || tiebreaks.parejas.length < 2) {
    redirect(`/torneo/${id}/ranking`);
  }

  const rankingMap = new Map(ranking.map((row) => [row.pareja.id, row]));
  const tiedPairsWithStats = tiebreaks.parejas.map((pareja) => {
    const row = rankingMap.get(pareja.id);
    return {
      id: pareja.id,
      nombre: pareja.nombre,
      gf: row?.gf ?? 0,
      gc: row?.gc ?? 0,
      diff: row?.diff ?? 0,
    };
  });

  return (
    <section>
      <TorneoHeader {...toTournamentHeaderProps(torneo)} />
      <DesempateClient
        torneoId={id}
        tiedPairs={tiedPairsWithStats}
        byeSlots={tiebreaks.byeSlotsInDispute}
      />
    </section>
  );
}
