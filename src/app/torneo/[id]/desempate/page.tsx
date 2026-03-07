import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectGroupResults } from "@/lib/tournament-service";
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
    where: { id, userId: authUser.userId },
    include: {
      parejas: true,
      grupos: { include: { partidos: true } },
    },
  });

  if (!torneo) {
    notFound();
  }

  const pairs = torneo.parejas.map((pair) => ({ id: pair.id, nombre: resolvePairDisplayName(pair) }));
  const ranking = computeRanking(pairs, collectGroupResults(torneo.grupos));
  const byes = getBracketSize(pairs.length) - pairs.length;
  const tiebreaks = detectTiebreaks(ranking, byes);

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
      <DesempateClient
        torneoId={id}
        tiedPairs={tiedPairsWithStats}
        byeSlots={tiebreaks.byeSlotsInDispute}
      />
    </section>
  );
}
