import { describe, expect, it } from "vitest";
import { applyTiebreakToRanking, buildTiebreakProgress } from "../tiebreak";
import type { Pareja, RankingEntry, TiebreakInfo } from "../types";

const parejas: Pareja[] = [
  { id: "a", nombre: "A" },
  { id: "b", nombre: "B" },
  { id: "c", nombre: "C" },
  { id: "d", nombre: "D" },
];

const ranking: RankingEntry[] = [
  { pareja: parejas[0], gf: 10, gc: 9, diff: 1 },
  { pareja: parejas[1], gf: 10, gc: 9, diff: 1 },
  { pareja: parejas[2], gf: 10, gc: 9, diff: 1 },
  { pareja: parejas[3], gf: 8, gc: 12, diff: -4 },
];

describe("tiebreak progression", () => {
  it("3 empatadas / 1 BYE crea progresion de eliminacion directa", () => {
    const info: TiebreakInfo = {
      parejas: [parejas[0], parejas[1], parejas[2]],
      byeSlotsInDispute: 1,
    };

    const initial = buildTiebreakProgress(info, []);
    expect(initial).toMatchObject({
      aliveIds: ["a", "b", "c"],
      eliminatedIds: [],
      complete: false,
      expectedDuelPairIds: ["a", "b"],
    });

    const afterFirst = buildTiebreakProgress(info, [
      {
        id: "001",
        pareja1Id: "a",
        pareja2Id: "b",
        ganadorId: "a",
        resuelto: true,
      },
    ]);
    expect(afterFirst).toMatchObject({
      aliveIds: ["a", "c"],
      eliminatedIds: ["b"],
      complete: false,
      expectedDuelPairIds: ["a", "c"],
    });

    const afterSecond = buildTiebreakProgress(info, [
      {
        id: "001",
        pareja1Id: "a",
        pareja2Id: "b",
        ganadorId: "a",
        resuelto: true,
      },
      {
        id: "002",
        pareja1Id: "a",
        pareja2Id: "c",
        ganadorId: "c",
        resuelto: true,
      },
    ]);

    expect(afterSecond).toMatchObject({
      aliveIds: ["c"],
      eliminatedIds: ["b", "a"],
      complete: true,
      expectedDuelPairIds: null,
    });
  });

  it("aplica el desempate completo al orden del ranking", () => {
    const info: TiebreakInfo = {
      parejas: [parejas[0], parejas[1], parejas[2]],
      byeSlotsInDispute: 1,
    };
    const progress = buildTiebreakProgress(info, [
      {
        id: "001",
        pareja1Id: "a",
        pareja2Id: "b",
        ganadorId: "a",
        resuelto: true,
      },
      {
        id: "002",
        pareja1Id: "a",
        pareja2Id: "c",
        ganadorId: "c",
        resuelto: true,
      },
    ]);

    const resolved = applyTiebreakToRanking(ranking, progress);
    expect(resolved.slice(0, 3).map((item) => item.pareja.id)).toEqual(["c", "a", "b"]);
  });
});
