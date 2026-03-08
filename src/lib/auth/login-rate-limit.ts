import { ApiError } from "@/lib/api";

type LoginRateLimitState = {
  attempts: number;
  windowStartedAt: number;
  blockedUntil: number;
};

declare global {
  var __loginRateLimitStore__: Map<string, LoginRateLimitState> | undefined;
}

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

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const RATE_LIMIT_MAX_ATTEMPTS = parsePositiveInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 8);
const RATE_LIMIT_BLOCK_MS = parsePositiveInt(process.env.LOGIN_RATE_LIMIT_BLOCK_MS, 15 * 60 * 1000);
const RATE_LIMIT_MAX_KEYS = 10_000;

const rateLimitStore = globalThis.__loginRateLimitStore__ ?? new Map<string, LoginRateLimitState>();
if (!globalThis.__loginRateLimitStore__) {
  globalThis.__loginRateLimitStore__ = rateLimitStore;
}

function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown-ip";
}

function cleanupRateLimitStore(now: number) {
  if (rateLimitStore.size < RATE_LIMIT_MAX_KEYS) {
    return;
  }

  for (const [key, value] of rateLimitStore) {
    const windowExpired = now - value.windowStartedAt > RATE_LIMIT_WINDOW_MS;
    const blockExpired = value.blockedUntil <= now;
    if (windowExpired && blockExpired) {
      rateLimitStore.delete(key);
    }
  }
}

export function buildLoginRateLimitKey(request: Request, username: string): string {
  return `${resolveClientIp(request)}:${username.toLowerCase()}`;
}

export function assertLoginAttemptAllowed(key: string) {
  const now = Date.now();
  const state = rateLimitStore.get(key);

  if (!state) {
    cleanupRateLimitStore(now);
    rateLimitStore.set(key, {
      attempts: 1,
      windowStartedAt: now,
      blockedUntil: 0,
    });
    return;
  }

  if (state.blockedUntil > now) {
    throw new ApiError("Demasiados intentos. Espera unos minutos e intenta nuevamente.", 429);
  }

  const withinWindow = now - state.windowStartedAt <= RATE_LIMIT_WINDOW_MS;
  const nextAttempts = withinWindow ? state.attempts + 1 : 1;

  if (nextAttempts > RATE_LIMIT_MAX_ATTEMPTS) {
    rateLimitStore.set(key, {
      attempts: nextAttempts,
      windowStartedAt: now,
      blockedUntil: now + RATE_LIMIT_BLOCK_MS,
    });
    throw new ApiError("Demasiados intentos. Espera unos minutos e intenta nuevamente.", 429);
  }

  rateLimitStore.set(key, {
    attempts: nextAttempts,
    windowStartedAt: withinWindow ? state.windowStartedAt : now,
    blockedUntil: 0,
  });
}

export function clearLoginRateLimit(key: string) {
  rateLimitStore.delete(key);
}
