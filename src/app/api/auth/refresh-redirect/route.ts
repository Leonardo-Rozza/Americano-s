import { type NextRequest, NextResponse } from "next/server";
import { createApiRequestContext } from "@/lib/api";
import {
  readCookieFromRequest,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { revokeAuthSession, rotateAuthSession } from "@/lib/auth/session";
import { verifySecret } from "@/lib/auth/password";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/refresh-redirect?next=/ruta
 *
 * Llamado por el middleware cuando el access token expiró pero hay refresh token.
 * Rota la sesión, setea nuevas cookies y redirige a `next`.
 * En caso de error, redirige a /login.
 */
export async function GET(request: NextRequest) {
  const context = createApiRequestContext(request, "auth.refresh_redirect");
  const rawNext = request.nextUrl.searchParams.get("next");
  const isReasonableLength = typeof rawNext === "string" && rawNext.length <= 1024;
  const next =
    isReasonableLength &&
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/api/")
      ? rawNext
      : "/dashboard";
  const loginUrl = new URL("/login", request.url);

  try {
    const refreshToken = readCookieFromRequest(request, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      logger.info("auth.refresh_redirect.missing_refresh_token", context);
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyRefreshToken(refreshToken);

    const session = await db.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!session || !session.user || session.userId !== payload.sub) {
      logger.warn("auth.refresh_redirect.invalid_session", context);
      return NextResponse.redirect(loginUrl);
    }
    context.userId = session.user.id;
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      logger.info("auth.refresh_redirect.expired_or_revoked", context);
      return NextResponse.redirect(loginUrl);
    }

    const tokenMatches = await verifySecret(refreshToken, session.refreshTokenHash);
    if (!tokenMatches) {
      await revokeAuthSession(session.id);
      logger.warn("auth.refresh_redirect.token_mismatch", context);
      return NextResponse.redirect(loginUrl);
    }

    const accessToken = await signAccessToken({
      userId: session.user.id,
      username: session.user.username,
    });
    const nextRefreshToken = await signRefreshToken({
      userId: session.user.id,
      sessionId: session.id,
    });

    await rotateAuthSession({ sessionId: session.id, refreshToken: nextRefreshToken });

    // Redirigir al destino original con las nuevas cookies
    const response = NextResponse.redirect(new URL(next, request.url));
    setAuthCookies(response, accessToken, nextRefreshToken);
    return response;
  } catch (error) {
    logger.warn("auth.refresh_redirect.failed", {
      ...context,
      error,
    });
    return NextResponse.redirect(loginUrl);
  }
}
