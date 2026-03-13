import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTx, mockDb, mockGetTorneoOrThrow, mockRequireApiAuth } = vi.hoisted(() => {
  const mockTx = {
    torneo: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    desempate: {
      updateMany: vi.fn(),
    },
    pareja: {
      update: vi.fn(),
    },
  };

  const mockDb = {
    $transaction: vi.fn(),
  };

  const mockGetTorneoOrThrow = vi.fn();
  const mockRequireApiAuth = vi.fn();

  return { mockTx, mockDb, mockGetTorneoOrThrow, mockRequireApiAuth };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/tournament-service", () => ({
  getTorneoOrThrow: mockGetTorneoOrThrow,
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireApiAuth: mockRequireApiAuth,
}));

import { PUT } from "./route";

describe("PUT /api/torneo/[id] pairMode=GENERIC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiAuth.mockResolvedValue({
      userId: "user-1",
      username: "admin",
    });
    mockDb.$transaction.mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
      callback(mockTx),
    );
  });

  it("regenera todas las parejas con nombre generico y limpia jugador1/jugador2", async () => {
    mockTx.torneo.findFirst.mockResolvedValue({
      id: "torneo-1",
      estado: "GRUPOS",
      parejas: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    });
    mockGetTorneoOrThrow.mockResolvedValue({
      id: "torneo-1",
    });

    const request = new Request("http://localhost/api/torneo/torneo-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairMode: "GENERIC",
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "torneo-1" }),
    });
    const payload = (await response.json()) as { success: boolean };

    expect(payload.success).toBe(true);
    expect(mockTx.pareja.update).toHaveBeenCalledTimes(3);
    expect(mockTx.pareja.update).toHaveBeenNthCalledWith(1, {
      where: { id: "p1" },
      data: { jugador1: null, jugador2: null, nombre: "Pareja 1" },
    });
    expect(mockTx.pareja.update).toHaveBeenNthCalledWith(2, {
      where: { id: "p2" },
      data: { jugador1: null, jugador2: null, nombre: "Pareja 2" },
    });
    expect(mockTx.pareja.update).toHaveBeenNthCalledWith(3, {
      where: { id: "p3" },
      data: { jugador1: null, jugador2: null, nombre: "Pareja 3" },
    });
    expect(mockTx.torneo.update).not.toHaveBeenCalled();
    expect(mockTx.desempate.updateMany).not.toHaveBeenCalled();
    expect(mockGetTorneoOrThrow).toHaveBeenCalledWith(mockDb, "torneo-1", "user-1");
  });

  it("actualiza la categoria del torneo mientras no este finalizado", async () => {
    mockTx.torneo.findFirst.mockResolvedValue({
      id: "torneo-1",
      estado: "GRUPOS",
      parejas: [],
    });
    mockGetTorneoOrThrow.mockResolvedValue({
      id: "torneo-1",
      categoriaPadel: "SEXTA",
    });

    const request = new Request("http://localhost/api/torneo/torneo-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoriaPadel: "SEXTA",
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "torneo-1" }),
    });
    const payload = (await response.json()) as { success: boolean };

    expect(payload.success).toBe(true);
    expect(mockTx.torneo.update).toHaveBeenCalledWith({
      where: { id: "torneo-1" },
      data: { categoriaPadel: "SEXTA" },
    });
  });

  it("rechaza jugadores repetidos entre parejas al editar", async () => {
    const request = new Request("http://localhost/api/torneo/torneo-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parejas: [
          { id: "p1", jugador1: "Juan", jugador2: "Perez" },
          { id: "p2", jugador1: "Juan", jugador2: "Lopez" },
        ],
      }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "torneo-1" }),
    });
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Este jugador ya fue cargado en otra pareja");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
