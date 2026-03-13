import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { NextResponse } from "next/server";
import { appConfig, getJwtSecret } from "@/lib/config";

const JWT_ALGORITHM = "HS256";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;        // 1 hora
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 5;  // 5 horas

type AccessTokenClaims = {
  username: string;
  type: "access";
};

type RefreshTokenClaims = {
  sid: string;
  type: "refresh";
};

export type AccessTokenPayload = JWTPayload &
  AccessTokenClaims & {
    sub: string;
  };

export type RefreshTokenPayload = JWTPayload &
  RefreshTokenClaims & {
    sub: string;
  };

function jwtSecret(): Uint8Array {
  const secret = getJwtSecret();
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no configurado o demasiado corto. Debe tener al menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export function refreshExpiresAtFromNow(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

export async function signAccessToken(input: { userId: string; username: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    username: input.username,
    type: "access",
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setIssuer(appConfig.auth.jwtIssuer)
    .setAudience(appConfig.auth.jwtAudience)
    .setSubject(input.userId)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setJti(crypto.randomUUID())
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(jwtSecret());
}

export async function signRefreshToken(input: { userId: string; sessionId: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sid: input.sessionId,
    type: "refresh",
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setIssuer(appConfig.auth.jwtIssuer)
    .setAudience(appConfig.auth.jwtAudience)
    .setSubject(input.userId)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setJti(crypto.randomUUID())
    .setExpirationTime(now + REFRESH_TOKEN_TTL_SECONDS)
    .sign(jwtSecret());
}

async function verifyToken<T extends "access" | "refresh">(
  token: string,
  expectedType: T,
): Promise<T extends "access" ? AccessTokenPayload : RefreshTokenPayload> {
  const { payload, protectedHeader } = await jwtVerify(token, jwtSecret(), {
    algorithms: [JWT_ALGORITHM],
    issuer: appConfig.auth.jwtIssuer,
    audience: appConfig.auth.jwtAudience,
  });

  if (protectedHeader.alg !== JWT_ALGORITHM) {
    throw new Error("Algoritmo JWT invalido.");
  }
  if (payload.type !== expectedType) {
    throw new Error("Tipo de token invalido.");
  }
  if (!payload.sub) {
    throw new Error("Token sin subject.");
  }

  return payload as T extends "access" ? AccessTokenPayload : RefreshTokenPayload;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  return verifyToken(token, "access");
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  return verifyToken(token, "refresh");
}

export async function tryVerifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}

export function readCookieFromRequest(request: Request, key: string): string | null {
  const rawCookies = request.headers.get("cookie");
  if (!rawCookies) {
    return null;
  }

  const cookiesList = rawCookies.split(";");
  for (const cookiePart of cookiesList) {
    const [name, ...valueParts] = cookiePart.trim().split("=");
    if (name !== key) {
      continue;
    }
    return valueParts.join("=");
  }

  return null;
}
