import { ApiError } from "@/lib/api";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SAME_SITE_VALUES = new Set(["same-origin", "same-site", "none"]);

function normalizeOrigin(rawOrigin: string): string | null {
  try {
    const parsed = new URL(rawOrigin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function resolveExpectedOrigin(request: Request): string | null {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;

  if (!host) {
    return null;
  }
  return `${protocol}://${host}`;
}

function resolveAllowedOrigins(request: Request): Set<string> {
  const allowedOrigins = new Set<string>();
  const expectedOrigin = resolveExpectedOrigin(request);
  if (expectedOrigin) {
    allowedOrigins.add(expectedOrigin);
  }

  const fromEnv = process.env.AUTH_ALLOWED_ORIGINS;
  if (fromEnv) {
    for (const item of fromEnv.split(",")) {
      const normalized = normalizeOrigin(item.trim());
      if (normalized) {
        allowedOrigins.add(normalized);
      }
    }
  }

  return allowedOrigins;
}

export function assertSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    const allowedOrigins = resolveAllowedOrigins(request);
    if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
      throw new ApiError("Origen no permitido.", 403);
    }
    return;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !SAME_SITE_VALUES.has(secFetchSite)) {
    throw new ApiError("Solicitud bloqueada por CSRF.", 403);
  }
}
