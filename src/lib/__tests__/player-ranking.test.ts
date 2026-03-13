import { describe, expect, it } from "vitest";
import { computePlayerRankingByCategory } from "../player-ranking";

function buildCustomPair(id: string, jugador1: string, jugador2: string) {
  return {
    id,
    nombre: `${jugador1} - ${jugador2}`,
    jugador1,
    jugador2,
  };
}

function buildGenericPair(id: string, index: number) {
  return {
    id,
    nombre: `Pareja ${index}`,
    jugador1: null,
    jugador2: null,
  };
}

describe("player ranking", () => {
  it("asigna puntos solo a torneos elegibles de la categoria elegida", () => {
    const summary = computePlayerRankingByCategory(
      [
        {
          id: "t1",
          nombre: "Quinta 1",
          fecha: new Date("2026-03-13T10:00:00.000Z"),
          categoriaPadel: "QUINTA",
          estado: "FINALIZADO",
          parejas: [
            buildCustomPair("p1", "Ana", "Bea"),
            buildCustomPair("p2", "Carla", "Dani"),
            buildCustomPair("p3", "Eva", "Flor"),
            buildCustomPair("p4", "Gina", "Hana"),
            buildCustomPair("p5", "Ines", "Julia"),
            buildCustomPair("p6", "Kari", "Luna"),
            buildCustomPair("p7", "Mora", "Nora"),
            buildCustomPair("p8", "Ona", "Pia"),
          ],
          bracket: {
            totalRondas: 3,
            matches: [
              { id: "q1", ronda: 1, posicion: 0, pareja1Id: "p1", pareja2Id: "p2", ganadorId: "p1", completado: true, esBye: false },
              { id: "q2", ronda: 1, posicion: 1, pareja1Id: "p3", pareja2Id: "p4", ganadorId: "p3", completado: true, esBye: false },
              { id: "q3", ronda: 1, posicion: 2, pareja1Id: "p5", pareja2Id: "p6", ganadorId: "p5", completado: true, esBye: false },
              { id: "q4", ronda: 1, posicion: 3, pareja1Id: "p7", pareja2Id: "p8", ganadorId: "p7", completado: true, esBye: false },
              { id: "s1", ronda: 2, posicion: 0, pareja1Id: "p1", pareja2Id: "p3", ganadorId: "p1", completado: true, esBye: false },
              { id: "s2", ronda: 2, posicion: 1, pareja1Id: "p5", pareja2Id: "p7", ganadorId: "p5", completado: true, esBye: false },
              { id: "f", ronda: 3, posicion: 0, pareja1Id: "p1", pareja2Id: "p5", ganadorId: "p1", completado: true, esBye: false },
            ],
          },
        },
        {
          id: "t2",
          nombre: "Quinta generica",
          fecha: new Date("2026-03-14T10:00:00.000Z"),
          categoriaPadel: "QUINTA",
          estado: "FINALIZADO",
          parejas: [buildGenericPair("g1", 1), buildGenericPair("g2", 2)],
          bracket: {
            totalRondas: 1,
            matches: [
              { id: "gf", ronda: 1, posicion: 0, pareja1Id: "g1", pareja2Id: "g2", ganadorId: "g1", completado: true, esBye: false },
            ],
          },
        },
        {
          id: "t3",
          nombre: "Sexta 1",
          fecha: new Date("2026-03-15T10:00:00.000Z"),
          categoriaPadel: "SEXTA",
          estado: "FINALIZADO",
          parejas: [buildCustomPair("s1", "Rita", "Sara"), buildCustomPair("s2", "Tati", "Uma")],
          bracket: {
            totalRondas: 1,
            matches: [
              { id: "sf", ronda: 1, posicion: 0, pareja1Id: "s1", pareja2Id: "s2", ganadorId: "s1", completado: true, esBye: false },
            ],
          },
        },
      ],
      "QUINTA",
    );

    expect(summary.totalFinalizedTournaments).toBe(2);
    expect(summary.includedTournaments).toBe(1);
    expect(summary.excludedTournaments).toBe(1);
    expect(summary.rows[0]).toMatchObject({
      nombre: "Ana",
      puntos: 100,
      campeonatos: 1,
      torneos: 1,
    });
    expect(summary.rows.find((row) => row.nombre === "Ines")).toMatchObject({
      puntos: 70,
      finales: 1,
    });
    expect(summary.rows.find((row) => row.nombre === "Eva")).toMatchObject({
      puntos: 50,
      semifinales: 1,
    });
    expect(summary.rows.find((row) => row.nombre === "Carla")).toMatchObject({
      puntos: 35,
      cuartos: 1,
    });
    expect(summary.rows.find((row) => row.nombre === "Rita")).toBeUndefined();
  });

  it("no inventa cuartos cuando el cuadro arranca en semifinal", () => {
    const summary = computePlayerRankingByCategory(
      [
        {
          id: "t1",
          nombre: "Cuarta 1",
          fecha: new Date("2026-03-13T10:00:00.000Z"),
          categoriaPadel: "CUARTA",
          estado: "FINALIZADO",
          parejas: [
            buildCustomPair("p1", "Ana", "Bea"),
            buildCustomPair("p2", "Carla", "Dani"),
            buildCustomPair("p3", "Eva", "Flor"),
            buildCustomPair("p4", "Gina", "Hana"),
          ],
          bracket: {
            totalRondas: 2,
            matches: [
              { id: "s1", ronda: 1, posicion: 0, pareja1Id: "p1", pareja2Id: "p2", ganadorId: "p1", completado: true, esBye: false },
              { id: "s2", ronda: 1, posicion: 1, pareja1Id: "p3", pareja2Id: "p4", ganadorId: "p3", completado: true, esBye: false },
              { id: "f", ronda: 2, posicion: 0, pareja1Id: "p1", pareja2Id: "p3", ganadorId: "p1", completado: true, esBye: false },
            ],
          },
        },
      ],
      "CUARTA",
    );

    expect(summary.rows.find((row) => row.nombre === "Carla")).toMatchObject({
      puntos: 50,
      cuartos: 0,
      semifinales: 1,
    });
  });
});
