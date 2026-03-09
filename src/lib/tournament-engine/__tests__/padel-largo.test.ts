import { describe, expect, it } from "vitest";
import {
  computeLargoRanking,
  getLargoClassified,
  getLargoFixture,
  resolveLargoQualifiersByGroupSize,
} from "../largo";
import {
  evaluatePadelLargoDraft,
  validatePadelLargoScore,
} from "../scoring/padel-largo";

describe("padel largo scoring", () => {
  it("valida partido 2-0 y 2-1 con set completo", () => {
    const twoZero = validatePadelLargoScore({
      sets: [
        { p1: 6, p2: 3 },
        { p1: 6, p2: 4 },
      ],
    });
    expect(twoZero.valid).toBe(true);

    const twoOne = validatePadelLargoScore({
      sets: [
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
        { p1: 7, p2: 5 },
      ],
    });
    expect(twoOne.valid).toBe(true);
  });

  it("rechaza super tie-break cuando no esta habilitado", () => {
    const invalid = validatePadelLargoScore({
      sets: [
        { p1: 6, p2: 3 },
        { p1: 4, p2: 6 },
        { p1: 10, p2: 8, superTiebreak: true },
      ],
    });
    expect(invalid.valid).toBe(false);
  });

  it("evalua borrador completo y detecta ganador", () => {
    const evaluation = evaluatePadelLargoDraft(
      {
        set1P1: "6",
        set1P2: "3",
        set2P1: "4",
        set2P2: "6",
        set3P1: "10",
        set3P2: "8",
      },
      { allowSuperTiebreakThirdSet: true },
    );

    expect(evaluation.status).toBe("valid");
    if (evaluation.status === "valid") {
      expect(evaluation.winner).toBe("p1");
    }
  });
});

describe("padel largo groups", () => {
  it("genera fixture round robin de 4 parejas", () => {
    expect(getLargoFixture(4)).toEqual([
      [0, 1],
      [2, 3],
      [0, 2],
      [1, 3],
      [0, 3],
      [1, 2],
    ]);
  });

  it("ranking aplica puntos 3/1 y clasifica top 2", () => {
    const pairs = [
      { id: "a", nombre: "A" },
      { id: "b", nombre: "B" },
      { id: "c", nombre: "C" },
    ];
    const ranking = computeLargoRanking(pairs, [
      {
        pareja1Id: "a",
        pareja2Id: "b",
        completado: true,
        scoreJson: { sets: [{ p1: 6, p2: 3 }, { p1: 6, p2: 4 }] },
      },
      {
        pareja1Id: "a",
        pareja2Id: "c",
        completado: true,
        scoreJson: { sets: [{ p1: 6, p2: 2 }, { p1: 6, p2: 2 }] },
      },
      {
        pareja1Id: "b",
        pareja2Id: "c",
        completado: true,
        scoreJson: { sets: [{ p1: 6, p2: 4 }, { p1: 6, p2: 4 }] },
      },
    ]);

    expect(ranking[0].pareja.id).toBe("a");
    expect(ranking[0].puntos).toBe(6);
    expect(ranking[1].pareja.id).toBe("b");
    expect(ranking[1].puntos).toBe(4);

    const classified = getLargoClassified([
      {
        groupId: "g1",
        groupName: "A",
        rows: ranking,
      },
    ]);
    expect(classified.map((item) => item.pareja.id)).toEqual(["a", "b"]);
  });

  it("en zona de 4 clasifica top 3 por default", () => {
    const rows = [
      { pareja: { id: "a", nombre: "A" } },
      { pareja: { id: "b", nombre: "B" } },
      { pareja: { id: "c", nombre: "C" } },
      { pareja: { id: "d", nombre: "D" } },
    ] as ReturnType<typeof computeLargoRanking>;

    const classified = getLargoClassified([
      {
        groupId: "g1",
        groupName: "A",
        rows,
      },
    ]);
    expect(classified.map((item) => item.pareja.id)).toEqual(["a", "b", "c"]);
  });

  it("resuelve qualifiersByGroupSize desde config con fallback seguro", () => {
    expect(resolveLargoQualifiersByGroupSize(null)).toEqual({ "3": 2, "4": 3 });
    expect(
      resolveLargoQualifiersByGroupSize({
        qualifiersByGroupSize: { "3": 1 },
      }),
    ).toEqual({ "3": 1, "4": 3 });
  });
});
