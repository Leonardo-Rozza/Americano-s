import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { collectGroupResults } from "@/lib/tournament-service";
import { computeRanking, detectTiebreaks } from "@/lib/tournament-engine/ranking";
import { getBracketSize } from "@/lib/tournament-engine/bracket";
import { DesempateClient } from "@/components/tournament/DesempateClient";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function DesempatePage({ params }: RouteParams) {
  const { id } = await params;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      parejas: true,
      grupos: {
        include: {
          partidos: true,
        },
      },
      desempates: {
        where: { resuelto: false },
      },
    },
  });

  if (!torneo) {
    notFound();
  }

  const pairs = torneo.parejas.map((pair) => ({ id: pair.id, nombre: pair.nombre }));
  const ranking = computeRanking(pairs, collectGroupResults(torneo.grupos));
  const byes = getBracketSize(pairs.length) - pairs.length;
  const tiebreaks = detectTiebreaks(ranking, byes);

  if (!tiebreaks || tiebreaks.parejas.length < 2) {
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
        byeSlots={tiebreaks.byeSlotsInDispute}
        pendingRecords={torneo.desempates.map((item) => ({
          id: item.id,
          pareja1Id: item.pareja1Id,
          pareja2Id: item.pareja2Id,
        }))}
      />
    </section>
  );
}
