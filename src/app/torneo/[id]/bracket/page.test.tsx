import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockRequirePageAuth } = vi.hoisted(() => {
  return {
    mockDb: {
      torneo: {
        findFirst: vi.fn(),
      },
    },
    mockRequirePageAuth: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requirePageAuth: mockRequirePageAuth,
}));

vi.mock("@/components/tournament/BracketClient", () => ({
  BracketClient: () => null,
}));

vi.mock("@/components/tournament/LargoBracketClient", () => ({
  LargoBracketClient: () => null,
}));

vi.mock("@/components/tournament/GoToBracketButton", () => ({
  GoToBracketButton: () => null,
}));

vi.mock("@/components/tournament/TorneoHeader", () => ({
  TorneoHeader: () => null,
}));

import BracketPage from "./page";

describe("BracketPage public access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePageAuth.mockResolvedValue({
      userId: "user-1",
      username: "admin",
    });
    mockDb.torneo.findFirst.mockResolvedValue({
      id: "torneo-1",
      nombre: "Americano",
      fecha: new Date("2026-03-13T10:00:00.000Z"),
      estado: "ELIMINATORIA",
      formato: "AMERICANO",
      deporte: "PADEL",
      config: null,
      _count: { parejas: 4 },
      parejas: [
        { id: "p1", nombre: "Ana - Bea", jugador1: "Ana", jugador2: "Bea" },
        { id: "p2", nombre: "Carla - Dani", jugador1: "Carla", jugador2: "Dani" },
      ],
      bracket: {
        id: "b1",
        totalRondas: 1,
        matches: [],
      },
    });
  });

  it("permite view=public sin requerir sesion", async () => {
    const element = await BracketPage({
      params: Promise.resolve({ id: "torneo-1" }),
      searchParams: Promise.resolve({ view: "public" }),
    });

    expect(mockRequirePageAuth).not.toHaveBeenCalled();
    expect(mockDb.torneo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "torneo-1" },
      }),
    );
    expect(element).toBeTruthy();
  });

  it("mantiene auth en la vista privada", async () => {
    await BracketPage({
      params: Promise.resolve({ id: "torneo-1" }),
      searchParams: Promise.resolve({}),
    });

    expect(mockRequirePageAuth).toHaveBeenCalledTimes(1);
    expect(mockDb.torneo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "torneo-1", userId: "user-1" },
      }),
    );
  });
});
