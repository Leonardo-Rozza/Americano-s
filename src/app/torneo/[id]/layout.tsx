import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TorneoHeader } from "@/components/tournament/TorneoHeader";
import { requirePageAuth } from "@/lib/auth/require-auth";

type LayoutParams = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function TorneoLayout({ children, params }: LayoutParams) {
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
    },
  });

  if (!torneo) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-8">
      <TorneoHeader
        torneoId={torneo.id}
        nombre={torneo.nombre}
        fechaISO={torneo.fecha.toISOString()}
        parejas={torneo._count.parejas}
        estado={torneo.estado}
      />
      {children}
    </main>
  );
}
