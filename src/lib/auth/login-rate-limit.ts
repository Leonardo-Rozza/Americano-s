import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { appConfig, getLoginRateLimitSecret } from "@/lib/config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const RATE_LIMIT_WINDOW_MS = appConfig.auth.loginRateLimit.windowMs;
const RATE_LIMIT_MAX_ATTEMPTS = appConfig.auth.loginRateLimit.maxAttempts;
const RATE_LIMIT_BLOCK_MS = appConfig.auth.loginRateLimit.blockMs;
const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera unos minutos e intenta nuevamente.";
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_TRANSACTION_RETRIES = 2;

let lastExpiredCleanupAt = 0;

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

function hashRateLimitKey(key: string) {
  return createHmac("sha256", getLoginRateLimitSecret()).update(key).digest("hex");
}

function computeExpiry(windowStartedAt: Date, blockedUntil: Date | null) {
  const windowExpiresAt = new Date(windowStartedAt.getTime() + RATE_LIMIT_WINDOW_MS);
  if (!blockedUntil) {
    return windowExpiresAt;
  }

  return blockedUntil.getTime() > windowExpiresAt.getTime() ? blockedUntil : windowExpiresAt;
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

async function withRateLimitTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let attempt = 0;

  while (attempt <= RATE_LIMIT_TRANSACTION_RETRIES) {
    try {
      return await db.$transaction((tx) => operation(tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (attempt < RATE_LIMIT_TRANSACTION_RETRIES && isRetryableTransactionError(error)) {
        logger.debug("auth.login_rate_limit.transaction_retry", {
          attempt: attempt + 1,
          error,
        });
        attempt += 1;
        continue;
      }

      throw error;
    }
  }

  throw new Error("No se pudo completar la transaccion de rate limit.");
}

function scheduleExpiredRateLimitCleanup(now: Date) {
  const nowMs = now.getTime();
  if (nowMs - lastExpiredCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastExpiredCleanupAt = nowMs;
  void db.loginRateLimit
    .deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    })
    .catch((error) => {
      logger.warn("auth.login_rate_limit.cleanup_failed", { error });
    });
}

export function buildLoginRateLimitKey(request: Request, username: string): string {
  return `${resolveClientIp(request)}:${username.toLowerCase()}`;
}

export async function assertLoginAttemptAllowed(key: string) {
  const now = new Date();
  const keyHash = hashRateLimitKey(key);
  scheduleExpiredRateLimitCleanup(now);

  const result = await withRateLimitTransaction(async (tx) => {
    const state = await tx.loginRateLimit.findUnique({
      where: { keyHash },
    });

    if (!state) {
      await tx.loginRateLimit.create({
        data: {
          keyHash,
          attempts: 1,
          windowStartedAt: now,
          blockedUntil: null,
          expiresAt: computeExpiry(now, null),
        },
      });
      return { blocked: false };
    }

    if (state.expiresAt.getTime() <= now.getTime()) {
      await tx.loginRateLimit.update({
        where: { keyHash },
        data: {
          attempts: 1,
          windowStartedAt: now,
          blockedUntil: null,
          expiresAt: computeExpiry(now, null),
        },
      });
      return { blocked: false };
    }

    if (state.blockedUntil && state.blockedUntil.getTime() > now.getTime()) {
      return { blocked: true };
    }

    const withinWindow = now.getTime() - state.windowStartedAt.getTime() <= RATE_LIMIT_WINDOW_MS;
    const nextAttempts = withinWindow ? state.attempts + 1 : 1;

    if (nextAttempts > RATE_LIMIT_MAX_ATTEMPTS) {
      const blockedUntil = new Date(now.getTime() + RATE_LIMIT_BLOCK_MS);
      await tx.loginRateLimit.update({
        where: { keyHash },
        data: {
          attempts: nextAttempts,
          windowStartedAt: now,
          blockedUntil,
          expiresAt: computeExpiry(now, blockedUntil),
        },
      });
      return { blocked: true };
    }

    const nextWindowStartedAt = withinWindow ? state.windowStartedAt : now;
    await tx.loginRateLimit.update({
      where: { keyHash },
      data: {
        attempts: nextAttempts,
        windowStartedAt: nextWindowStartedAt,
        blockedUntil: null,
        expiresAt: computeExpiry(nextWindowStartedAt, null),
      },
    });
    return { blocked: false };
  });

  if (result.blocked) {
    throw new ApiError(RATE_LIMIT_MESSAGE, 429);
  }
}

export async function clearLoginRateLimit(key: string) {
  await db.loginRateLimit.deleteMany({
    where: {
      keyHash: hashRateLimitKey(key),
    },
  });
}
