import { describe, expect, it } from "vitest";
import {
  calcGroups,
  calcGroupsPrioritizing4,
  createGroups,
  getFixtureR1,
  getFixtureR2,
  isValidGroupConfig,
  listGroupConfigs,
} from "../groups";
import type { Pareja } from "../types";

function makeParejas(n: number): Pareja[] {
  return Array.from({ length: n }, (_, idx) => ({
    id: `p${idx + 1}`,
    nombre: `Pareja ${idx + 1}`,
  }));
}

describe("groups", () => {
  it("calcGroups resuelve 12 parejas como 4 grupos de 3", () => {
    expect(calcGroups(12)).toEqual({ g3: 4, g4: 0 });
  });

  it("calcGroups resuelve 13 parejas como 3 grupos de 3 y 1 de 4", () => {
    expect(calcGroups(13)).toEqual({ g3: 3, g4: 1 });
  });

  it("calcGroupsPrioritizing4 prioriza grupos de 4 cuando hay alternativa", () => {
    expect(calcGroupsPrioritizing4(12)).toEqual({ g3: 0, g4: 3 });
  });

  it("listGroupConfigs devuelve alternativas validas para 12 parejas", () => {
    expect(listGroupConfigs(12)).toEqual([
      { g3: 4, g4: 0 },
      { g3: 0, g4: 3 },
    ]);
  });

  it("isValidGroupConfig valida combinaciones correctas", () => {
    expect(isValidGroupConfig(12, { g3: 4, g4: 0 })).toBe(true);
    expect(isValidGroupConfig(12, { g3: 0, g4: 3 })).toBe(true);
    expect(isValidGroupConfig(12, { g3: 2, g4: 1 })).toBe(false);
  });

  it("createGroups distribuye con tamanos validos", () => {
    const groups = createGroups(makeParejas(13));
    const sizes = groups.map((g) => g.length).sort((a, b) => a - b);
    expect(sizes).toEqual([3, 3, 3, 4]);
  });

  it("createGroups respeta configuracion explicita elegida", () => {
    const groups = createGroups(makeParejas(12), { g3: 0, g4: 3 });
    const sizes = groups.map((g) => g.length).sort((a, b) => a - b);
    expect(sizes).toEqual([4, 4, 4]);
  });

  it("getFixtureR1 devuelve fixtures esperados", () => {
    expect(getFixtureR1(3)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
    expect(getFixtureR1(4)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("getFixtureR2 para grupo de 4 arma ganadores y perdedores", () => {
    const r2 = getFixtureR2(4, [
      { winner: 0, loser: 1 },
      { winner: 3, loser: 2 },
    ]);
    expect(r2).toEqual([
      [0, 3],
      [1, 2],
    ]);
  });
});
