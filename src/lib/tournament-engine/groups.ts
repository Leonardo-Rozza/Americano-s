import type { GrupoConfig, Pareja, Round1Result } from "./types";

export function listGroupConfigs(n: number): GrupoConfig[] {
  if (n < 0) {
    throw new Error("La cantidad de parejas no puede ser negativa.");
  }

  if (n === 0) {
    return [{ g3: 0, g4: 0 }];
  }

  const configs: GrupoConfig[] = [];
  for (let g4 = 0; g4 <= Math.floor(n / 4); g4 += 1) {
    const rem = n - g4 * 4;
    if (rem < 0 || rem % 3 !== 0) {
      continue;
    }
    const g3 = rem / 3;
    if (g3 < 0 || g3 + g4 <= 0) {
      continue;
    }
    configs.push({ g3, g4 });
  }

  return configs.sort((a, b) => a.g4 - b.g4 || a.g3 - b.g3);
}

export function isValidGroupConfig(n: number, config: GrupoConfig): boolean {
  return listGroupConfigs(n).some((item) => item.g3 === config.g3 && item.g4 === config.g4);
}

export function calcGroups(n: number): GrupoConfig {
  const options = listGroupConfigs(n);
  if (options.length === 0) {
    throw new Error("No se pueden formar grupos validos con este numero de parejas.");
  }
  return options[0];
}

function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGroups(parejas: Pareja[], selectedConfig?: GrupoConfig): Pareja[][] {
  const config = selectedConfig ?? calcGroups(parejas.length);
  if (!isValidGroupConfig(parejas.length, config)) {
    throw new Error("La configuracion de grupos no es valida para esta cantidad de parejas.");
  }

  const { g3, g4 } = config;
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
