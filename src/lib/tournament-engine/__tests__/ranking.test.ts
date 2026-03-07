import { describe, expect, it } from "vitest";
import { computeRanking, detectTiebreaks } from "../ranking";
import type { MatchResult, Pareja } from "../types";

const parejas: Pareja[] = [
  { id: "a", nombre: "A" },
  { id: "b", nombre: "B" },
  { id: "c", nombre: "C" },
  { id: "d", nombre: "D" },
];

describe("ranking", () => {
  it("computeRanking calcula GF/GC/diff y ordena por diff luego gf", () => {
    const results: MatchResult[] = [
      { pareja1Id: "a", pareja2Id: "b", gamesPareja1: 6, gamesPareja2: 3 },
      { pareja1Id: "c", pareja2Id: "d", gamesPareja1: 6, gamesPareja2: 0 },
      { pareja1Id: "a", pareja2Id: "c", gamesPareja1: 4, gamesPareja2: 6 },
    ];

    const ranking = computeRanking(parejas, results);
    expect(ranking.map((row) => row.pareja.id)).toEqual(["c", "a", "b", "d"]);
    expect(ranking[0]).toMatchObject({ gf: 12, gc: 4, diff: 8 });
  });

  it("detectTiebreaks detecta empate en el corte de BYE", () => {
    const ranking = [
      { pareja: parejas[0], gf: 12, gc: 7, diff: 5 },
      { pareja: parejas[1], gf: 11, gc: 7, diff: 4 },
      { pareja: parejas[2], gf: 11, gc: 7, diff: 4 },
      { pareja: parejas[3], gf: 8, gc: 10, diff: -2 },
    ];

    const tie = detectTiebreaks(ranking, 2);
    expect(tie).toEqual({
      parejas: [parejas[1], parejas[2]],
      byeSlotsInDispute: 1,
    });
  });

  it("detectTiebreaks usa DIF para incluir bloque empatado aunque GF sea distinto", () => {
    const ranking = [
      { pareja: parejas[0], gf: 16, gc: 8, diff: 8 },
      { pareja: parejas[1], gf: 12, gc: 9, diff: 3 },
      { pareja: parejas[2], gf: 11, gc: 8, diff: 3 },
      { pareja: parejas[3], gf: 9, gc: 6, diff: 3 },
    ];

    const tie = detectTiebreaks(ranking, 2);
    expect(tie).toEqual({
      parejas: [parejas[1], parejas[2], parejas[3]],
      byeSlotsInDispute: 1,
    });
  });
});
