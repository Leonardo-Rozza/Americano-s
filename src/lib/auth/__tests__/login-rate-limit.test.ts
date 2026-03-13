import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockTx, mockLogger } = vi.hoisted(() => {
  const mockTx = {
    loginRateLimit: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockDb = {
    $transaction: vi.fn(),
    loginRateLimit: {
      deleteMany: vi.fn(),
    },
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return { mockDb, mockTx, mockLogger };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

describe("login rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T11:30:00.000Z"));
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockDb.$transaction.mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
      callback(mockTx),
    );
    mockDb.loginRateLimit.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("normaliza username y usa la primera IP forwarded para construir la key", async () => {
    const { buildLoginRateLimitKey } = await import("../login-rate-limit");

    const request = new Request("http://localhost/api/auth/login", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.5",
      },
    });

    expect(buildLoginRateLimitKey(request, "Admin")).toBe("203.0.113.10:admin");
  });

  it("crea el primer registro en base compartida y no persiste la key en claro", async () => {
    const { assertLoginAttemptAllowed } = await import("../login-rate-limit");

    mockTx.loginRateLimit.findUnique.mockResolvedValue(null);

    await assertLoginAttemptAllowed("203.0.113.10:admin");

    expect(mockTx.loginRateLimit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attempts: 1,
          blockedUntil: null,
          keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(mockTx.loginRateLimit.create.mock.calls[0][0].data.keyHash).not.toBe("203.0.113.10:admin");
    expect(mockDb.loginRateLimit.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("rechaza con 429 si la key ya sigue bloqueada", async () => {
    const { assertLoginAttemptAllowed } = await import("../login-rate-limit");

    mockTx.loginRateLimit.findUnique.mockResolvedValue({
      keyHash: "hash",
      attempts: 3,
      windowStartedAt: new Date("2026-03-13T11:25:00.000Z"),
      blockedUntil: new Date("2026-03-13T11:40:00.000Z"),
      expiresAt: new Date("2026-03-13T11:40:00.000Z"),
    });

    await expect(assertLoginAttemptAllowed("203.0.113.10:admin")).rejects.toMatchObject({
      status: 429,
      message: "Demasiados intentos. Espera unos minutos e intenta nuevamente.",
    });
    expect(mockTx.loginRateLimit.update).not.toHaveBeenCalled();
  });

  it("bloquea cuando supera el maximo permitido dentro de la ventana", async () => {
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", "1");
    const { assertLoginAttemptAllowed } = await import("../login-rate-limit");

    mockTx.loginRateLimit.findUnique.mockResolvedValue({
      keyHash: "hash",
      attempts: 1,
      windowStartedAt: new Date("2026-03-13T11:29:00.000Z"),
      blockedUntil: null,
      expiresAt: new Date("2026-03-13T11:39:00.000Z"),
    });

    await expect(assertLoginAttemptAllowed("203.0.113.10:admin")).rejects.toMatchObject({
      status: 429,
      message: "Demasiados intentos. Espera unos minutos e intenta nuevamente.",
    });
    expect(mockTx.loginRateLimit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attempts: 2,
          blockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it("reinicia el estado cuando el registro vencio", async () => {
    const { assertLoginAttemptAllowed } = await import("../login-rate-limit");

    mockTx.loginRateLimit.findUnique.mockResolvedValue({
      keyHash: "hash",
      attempts: 8,
      windowStartedAt: new Date("2026-03-13T10:00:00.000Z"),
      blockedUntil: null,
      expiresAt: new Date("2026-03-13T11:00:00.000Z"),
    });

    await assertLoginAttemptAllowed("203.0.113.10:admin");

    expect(mockTx.loginRateLimit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attempts: 1,
          blockedUntil: null,
        }),
      }),
    );
  });

  it("borra el registro persistido despues de un login exitoso", async () => {
    const { clearLoginRateLimit } = await import("../login-rate-limit");

    await clearLoginRateLimit("203.0.113.10:admin");

    expect(mockDb.loginRateLimit.deleteMany).toHaveBeenCalledWith({
      where: {
        keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(mockDb.loginRateLimit.deleteMany.mock.calls[0][0].where.keyHash).not.toBe(
      "203.0.113.10:admin",
    );
  });
});
