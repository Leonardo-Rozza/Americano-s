export type LogLevel = "debug" | "info" | "warn" | "error";

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseLogLevel(rawValue: string | undefined): LogLevel | null {
  switch (rawValue?.trim().toLowerCase()) {
    case "debug":
    case "info":
    case "warn":
    case "error":
      return rawValue.trim().toLowerCase() as LogLevel;
    default:
      return null;
  }
}

function splitCsv(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const configuredLogLevel = parseLogLevel(process.env.LOG_LEVEL);

export const appConfig = {
  env: process.env.NODE_ENV ?? "development",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://americano-s.vercel.app",
  logLevel: configuredLogLevel ?? "info",
  debugLogsEnabled:
    configuredLogLevel === "debug" || (process.env.NODE_ENV ?? "development") !== "production",
  auth: {
    jwtIssuer: process.env.JWT_ISSUER?.trim() || "torneos-americanos",
    jwtAudience: process.env.JWT_AUDIENCE?.trim() || "torneos-americanos-app",
    allowedOrigins: splitCsv(process.env.AUTH_ALLOWED_ORIGINS),
    loginRateLimit: {
      windowMs: parsePositiveInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
      maxAttempts: parsePositiveInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 8),
      blockMs: parsePositiveInt(process.env.LOGIN_RATE_LIMIT_BLOCK_MS, 15 * 60 * 1000),
    },
  },
} as const;

export function getJwtSecret() {
  return process.env.JWT_SECRET?.trim() ?? "";
}

export function getLoginRateLimitSecret() {
  return process.env.LOGIN_RATE_LIMIT_SECRET?.trim() || getJwtSecret() || "dev-login-rate-limit-secret";
}
