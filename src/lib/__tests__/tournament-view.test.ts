import { describe, expect, it } from "vitest";
import {
  buildAmericanoRankingSnapshot,
  buildLargoRankingSnapshot,
  toTournamentHeaderProps,
} from "../tournament-view";

describe("tournament-view", () => {
  it("construye el snapshot de ranking americano con display names y byes", () => {
    const snapshot = buildAmericanoRankingSnapshot({
      parejas: [
        { id: "p1", jugador1: "Ana", jugador2: "Bea" },
        { id: "p2", jugador1: "Carla", jugador2: "Dani" },
        { id: "p3", jugador1: "Eva", jugador2: "Flor" },
        { id: "p4", jugador1: "Gina", jugador2: "Hana" },
      ],
      grupos: [
        {
          partidos: [
            {
              pareja1Id: "p1",
              pareja2Id: "p2",
              gamesPareja1: 6,
              gamesPareja2: 0,
              completado: true,
            },
            {
              pareja1Id: "p3",
              pareja2Id: "p4",
              gamesPareja1: 6,
              gamesPareja2: 4,
              completado: true,
            },
          ],
        },
      ],
    });

    expect(snapshot.pairs[0]).toEqual({ id: "p1", nombre: "Ana - Bea" });
    expect(snapshot.bracketSize).toBe(4);
    expect(snapshot.byes).toBe(0);
    expect(snapshot.ranking[0].pareja.id).toBe("p1");
  });

  it("construye el snapshot largo y clasifica segun defaults", () => {
    const snapshot = buildLargoRankingSnapshot({
      grupos: [
        {
          id: "g1",
          nombre: "A",
          parejas: [
            { id: "p1", jugador1: "Ana", jugador2: "Bea" },
            { id: "p2", jugador1: "Carla", jugador2: "Dani" },
            { id: "p3", jugador1: "Eva", jugador2: "Flor" },
          ],
          partidos: [
            {
              pareja1Id: "p1",
              pareja2Id: "p2",
              completado: true,
              scoreJson: { sets: [{ p1: 6, p2: 3 }, { p1: 6, p2: 2 }] },
            },
            {
              pareja1Id: "p1",
              pareja2Id: "p3",
              completado: true,
              scoreJson: { sets: [{ p1: 6, p2: 4 }, { p1: 6, p2: 4 }] },
            },
            {
              pareja1Id: "p2",
              pareja2Id: "p3",
              completado: true,
              scoreJson: { sets: [{ p1: 4, p2: 6 }, { p1: 4, p2: 6 }] },
            },
          ],
        },
      ],
      config: null,
    });

    expect(snapshot.groupRankings).toHaveLength(1);
    expect(snapshot.groupRankings[0].rows[0].pareja.nombre).toBe("Ana - Bea");
    expect(snapshot.classified.map((item) => item.pareja.id)).toEqual(["p1", "p3"]);
    expect(snapshot.qualifiersByGroupSize).toEqual({ "3": 2, "4": 3 });
  });

  it("mapea props reutilizables para el header de torneo", () => {
    expect(
      toTournamentHeaderProps({
        id: "t1",
        nombre: "Americano",
        fecha: new Date("2026-03-13T10:00:00.000Z"),
        estado: "GRUPOS",
        _count: { parejas: 12 },
      }),
    ).toEqual({
      torneoId: "t1",
      nombre: "Americano",
      fechaISO: "2026-03-13T10:00:00.000Z",
      parejas: 12,
      estado: "GRUPOS",
    });
  });
});

