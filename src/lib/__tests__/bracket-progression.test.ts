import { describe, expect, it } from "vitest";
import { syncBracketProgression, type BracketProgressMatch } from "../bracket-progression";

function makeMatch(input: Partial<BracketProgressMatch> & Pick<BracketProgressMatch, "id" | "ronda" | "posicion">): BracketProgressMatch {
  return {
    id: input.id,
    ronda: input.ronda,
    posicion: input.posicion,
    esBye: input.esBye ?? false,
    pareja1Id: input.pareja1Id ?? null,
    pareja2Id: input.pareja2Id ?? null,
    ganadorId: input.ganadorId ?? null,
    gamesPareja1: input.gamesPareja1 ?? null,
    gamesPareja2: input.gamesPareja2 ?? null,
    completado: input.completado ?? false,
  };
}

describe("bracket progression", () => {
  it("deja visible al BYE esperando en la ronda siguiente sin auto-avanzar", () => {
    const matches: BracketProgressMatch[] = [
      makeMatch({ id: "r1m0", ronda: 1, posicion: 0, pareja1Id: "p1" }),
      makeMatch({ id: "r1m1", ronda: 1, posicion: 1, pareja1Id: "p8", pareja2Id: "p9" }),
      makeMatch({ id: "r2m0", ronda: 2, posicion: 0 }),
      makeMatch({ id: "r3m0", ronda: 3, posicion: 0 }),
    ];

    const synced = syncBracketProgression(matches, 3);
    const quarter = synced.find((m) => m.id === "r2m0");

    expect(quarter).toMatchObject({
      pareja1Id: "p1",
      pareja2Id: null,
      completado: false,
      esBye: true,
      ganadorId: null,
    });
  });

  it("cuando se completa el 8vos enfrenta al BYE en 4tos", () => {
    const matches: BracketProgressMatch[] = [
      makeMatch({ id: "r1m0", ronda: 1, posicion: 0, pareja1Id: "p1" }),
      makeMatch({
        id: "r1m1",
        ronda: 1,
        posicion: 1,
        pareja1Id: "p8",
        pareja2Id: "p9",
        completado: true,
        ganadorId: "p9",
        gamesPareja1: 3,
        gamesPareja2: 6,
      }),
      makeMatch({ id: "r2m0", ronda: 2, posicion: 0 }),
      makeMatch({ id: "r3m0", ronda: 3, posicion: 0 }),
    ];

    const synced = syncBracketProgression(matches, 3);
    const quarter = synced.find((m) => m.id === "r2m0");
    const semi = synced.find((m) => m.id === "r3m0");

    expect(quarter).toMatchObject({
      pareja1Id: "p1",
      pareja2Id: "p9",
      completado: false,
      esBye: false,
      ganadorId: null,
    });
    expect(semi).toMatchObject({
      pareja1Id: null,
      pareja2Id: null,
      completado: false,
    });
  });

  it("mantiene los cruces correctos y no enfrenta entre si a ganadores de llaves distintas", () => {
    const matches: BracketProgressMatch[] = [
      makeMatch({ id: "r1m0", ronda: 1, posicion: 0, pareja1Id: "p1" }),
      makeMatch({
        id: "r1m1",
        ronda: 1,
        posicion: 1,
        pareja1Id: "p8",
        pareja2Id: "p9",
        completado: true,
        ganadorId: "p9",
        gamesPareja1: 2,
        gamesPareja2: 6,
      }),
      makeMatch({ id: "r1m2", ronda: 1, posicion: 2, pareja1Id: "p2" }),
      makeMatch({
        id: "r1m3",
        ronda: 1,
        posicion: 3,
        pareja1Id: "p7",
        pareja2Id: "p10",
        completado: true,
        ganadorId: "p10",
        gamesPareja1: 4,
        gamesPareja2: 6,
      }),
      makeMatch({ id: "r2m0", ronda: 2, posicion: 0 }),
      makeMatch({ id: "r2m1", ronda: 2, posicion: 1 }),
      makeMatch({ id: "r3m0", ronda: 3, posicion: 0 }),
    ];

    const synced = syncBracketProgression(matches, 3);
    const qfA = synced.find((m) => m.id === "r2m0");
    const qfB = synced.find((m) => m.id === "r2m1");

    expect(qfA).toMatchObject({
      pareja1Id: "p1",
      pareja2Id: "p9",
      esBye: false,
      completado: false,
    });
    expect(qfB).toMatchObject({
      pareja1Id: "p2",
      pareja2Id: "p10",
      esBye: false,
      completado: false,
    });
  });

  it("no auto-avanza cuando un feeder esta marcado como completado pero sin ganador", () => {
    const matches: BracketProgressMatch[] = [
      makeMatch({
        id: "r1m0",
        ronda: 1,
        posicion: 0,
        pareja1Id: "p1",
        pareja2Id: "p8",
        completado: true,
        ganadorId: null,
      }),
      makeMatch({ id: "r1m1", ronda: 1, posicion: 1, pareja1Id: "p2" }),
      makeMatch({ id: "r2m0", ronda: 2, posicion: 0 }),
      makeMatch({ id: "r3m0", ronda: 3, posicion: 0 }),
    ];

    const synced = syncBracketProgression(matches, 3);
    const round1 = synced.find((m) => m.id === "r1m0");
    const round2 = synced.find((m) => m.id === "r2m0");

    expect(round1).toMatchObject({
      completado: false,
      ganadorId: null,
      gamesPareja1: null,
      gamesPareja2: null,
    });
    expect(round2).toMatchObject({
      pareja1Id: null,
      pareja2Id: "p2",
      esBye: true,
      completado: false,
      ganadorId: null,
    });
  });
});
