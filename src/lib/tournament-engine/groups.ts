import type { GrupoConfig, Pareja, Round1Result } from "./types";

export function calcGroups(n: number): GrupoConfig {
  if (n < 0) {
    throw new Error("La cantidad de parejas no puede ser negativa.");
  }

  if (n === 0) {
    return { g3: 0, g4: 0 };
  }

  const remainder = n % 3;
  if (remainder === 0) {
    return { g3: n / 3, g4: 0 };
  }
  if (remainder === 1) {
    if (n < 4) {
      throw new Error("No se pueden formar grupos validos con menos de 4 parejas.");
    }
    return { g3: (n - 4) / 3, g4: 1 };
  }
  if (n < 8) {
    throw new Error("No se pueden formar grupos validos con este numero de parejas.");
  }
  return { g3: (n - 8) / 3, g4: 2 };
}

function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGroups(parejas: Pareja[]): Pareja[][] {
  const { g3, g4 } = calcGroups(parejas.length);
  const sizes = [...Array<number>(g4).fill(4), ...Array<number>(g3).fill(3)];
  const shuffled = shuffle(parejas);
  const groups: Pareja[][] = [];

  let cursor = 0;
  for (const size of sizes) {
    groups.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }

  return groups;
}

export function getFixtureR1(groupSize: number): [number, number][] {
  if (groupSize === 3) {
    return [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
  }
  if (groupSize === 4) {
    return [
      [0, 1],
      [2, 3],
    ];
  }
  throw new Error("Solo se soportan grupos de 3 o 4.");
}

export function getFixtureR2(groupSize: number, r1Results: Round1Result[]): [number, number][] {
  if (groupSize !== 4) {
    return [];
  }
  if (r1Results.length < 2) {
    throw new Error("Se requieren 2 resultados de ronda 1 para grupos de 4.");
  }

  const [m1, m2] = r1Results;
  return [
    [m1.winner, m2.winner],
    [m1.loser, m2.loser],
  ];
}
