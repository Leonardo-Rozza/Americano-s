import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("usa defaults permisivos cuando faltan variables", async () => {
    const { appConfig, getJwtSecret } = await import("../config");

    expect(appConfig.siteUrl).toBe("https://americano-s.vercel.app");
    expect(appConfig.logLevel).toBe("info");
    expect(appConfig.auth.loginRateLimit.maxAttempts).toBe(8);
    expect(getJwtSecret()).toBe("");
  });

  it("normaliza y parsea configuracion desde variables de entorno", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", " https://example.com ");
    vi.stubEnv("LOG_LEVEL", "warn");
    vi.stubEnv("AUTH_ALLOWED_ORIGINS", "https://one.test, https://two.test ");
    vi.stubEnv("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", "5");
    vi.stubEnv("JWT_SECRET", " 12345678901234567890123456789012 ");

    const { appConfig, getJwtSecret } = await import("../config");

    expect(appConfig.siteUrl).toBe("https://example.com");
    expect(appConfig.logLevel).toBe("warn");
    expect(appConfig.auth.allowedOrigins).toEqual(["https://one.test", "https://two.test"]);
    expect(appConfig.auth.loginRateLimit.maxAttempts).toBe(5);
    expect(getJwtSecret()).toBe("12345678901234567890123456789012");
  });
});

