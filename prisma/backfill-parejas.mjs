import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LEGACY_SEPARATORS = [" - ", " / "];

function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

function splitLegacyPairName(rawName) {
  const cleanName = normalize(rawName ?? "");
  if (!cleanName) {
    return null;
  }

  for (const separator of LEGACY_SEPARATORS) {
    if (!cleanName.includes(separator)) {
      continue;
    }

    const parts = cleanName.split(separator).map(normalize);
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      continue;
    }

    return { jugador1: parts[0], jugador2: parts[1] };
  }

  return null;
}

async function run() {
  const legacyPairs = await prisma.pareja.findMany({
    where: {
      jugador1: null,
      jugador2: null,
      NOT: {
        nombre: null,
      },
    },
    select: {
      id: true,
      torneoId: true,
      nombre: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  let updated = 0;
  const unresolved = [];

  for (const pair of legacyPairs) {
    const parsed = splitLegacyPairName(pair.nombre);
    if (!parsed) {
      unresolved.push(pair);
      continue;
    }

    await prisma.pareja.update({
      where: { id: pair.id },
      data: {
        jugador1: parsed.jugador1,
        jugador2: parsed.jugador2,
        nombre: `${parsed.jugador1} - ${parsed.jugador2}`,
      },
    });

    updated += 1;
  }

  console.log(`Parejas legacy detectadas: ${legacyPairs.length}`);
  console.log(`Parejas actualizadas: ${updated}`);
  console.log(`Parejas sin parseo automatico: ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log("Revisar manualmente estos registros:");
    for (const pair of unresolved) {
      console.log(`- id=${pair.id} torneoId=${pair.torneoId} nombre='${pair.nombre}'`);
    }
  }
}

run()
  .catch((error) => {
    console.error("Error ejecutando backfill de parejas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
