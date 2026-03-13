import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("logger", () => {
  const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    infoSpy.mockClear();
    debugSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redacta campos sensibles al loggear", async () => {
    const { logger } = await import("../logger");

    logger.info("auth.event", {
      password: "secret",
      nested: {
        refreshToken: "token-value",
        keep: "visible",
      },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][1]).toEqual({
      password: "[REDACTED]",
      nested: {
        refreshToken: "[REDACTED]",
        keep: "visible",
      },
    });
  });

  it("omite debug en produccion salvo configuracion explicita", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { logger } = await import("../logger");

    logger.debug("debug.disabled");
    expect(debugSpy).not.toHaveBeenCalled();

    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "debug");

    const { logger: debugLogger } = await import("../logger");
    debugLogger.debug("debug.enabled");

    expect(debugSpy).toHaveBeenCalledTimes(1);
  });
});

