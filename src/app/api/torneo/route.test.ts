import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTx, mockDb, mockCreateTorneoWithGroups, mockGetTorneoOrThrow, mockRequireApiAuth } = vi.hoisted(() => {
  const mockTx = {};

  const mockDb = {
    $transaction: vi.fn(),
  };

  const mockCreateTorneoWithGroups = vi.fn();
  const mockGetTorneoOrThrow = vi.fn();
  const mockRequireApiAuth = vi.fn();

  return { mockTx, mockDb, mockCreateTorneoWithGroups, mockGetTorneoOrThrow, mockRequireApiAuth };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/tournament-service", () => ({
  createTorneoWithGroups: mockCreateTorneoWithGroups,
  getTorneoOrThrow: mockGetTorneoOrThrow,
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireApiAuth: mockRequireApiAuth,
}));

import { POST } from "./route";

describe("POST /api/torneo", () => {
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

  it("rechaza torneos de padel sin categoria", async () => {
    const request = new Request("http://localhost/api/torneo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Americano Quinta",
        deporte: "PADEL",
        formato: "AMERICANO",
        numParejas: 6,
        pairMode: "GENERIC",
        formatoGrupos: { g3: 2, g4: 0 },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Debes elegir una categoria");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("propaga la categoria al servicio de creacion", async () => {
    mockCreateTorneoWithGroups.mockResolvedValue("torneo-1");
    mockGetTorneoOrThrow.mockResolvedValue({
      id: "torneo-1",
    });

    const request = new Request("http://localhost/api/torneo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Americano Quinta",
        deporte: "PADEL",
        formato: "AMERICANO",
        categoriaPadel: "QUINTA_SEXTA",
        numParejas: 6,
        pairMode: "GENERIC",
        formatoGrupos: { g3: 2, g4: 0 },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { success: boolean };

    expect(payload.success).toBe(true);
    expect(mockCreateTorneoWithGroups).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        userId: "user-1",
        categoriaPadel: "QUINTA_SEXTA",
      }),
    );
  });

  it("rechaza jugadores repetidos entre distintas parejas", async () => {
    const request = new Request("http://localhost/api/torneo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Americano Quinta",
        deporte: "PADEL",
        formato: "AMERICANO",
        categoriaPadel: "QUINTA",
        numParejas: 6,
        pairMode: "CUSTOM",
        parejas: [
          { jugador1: "Juan", jugador2: "Perez" },
          { jugador1: "Juan", jugador2: "Lopez" },
          { jugador1: "Ana", jugador2: "Beto" },
          { jugador1: "Caro", jugador2: "Dani" },
          { jugador1: "Ema", jugador2: "Fede" },
          { jugador1: "Gus", jugador2: "Hugo" },
        ],
        formatoGrupos: { g3: 2, g4: 0 },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Este jugador ya fue cargado en otra pareja");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
