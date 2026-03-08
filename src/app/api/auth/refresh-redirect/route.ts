import { type NextRequest, NextResponse } from "next/server";
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

/**
 * GET /api/auth/refresh-redirect?next=/ruta
 *
 * Llamado por el middleware cuando el access token expiró pero hay refresh token.
 * Rota la sesión, setea nuevas cookies y redirige a `next`.
 * En caso de error, redirige a /login.
 */
export async function GET(request: NextRequest) {
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
    if (!refreshToken) return NextResponse.redirect(loginUrl);

    const payload = await verifyRefreshToken(refreshToken);

    const session = await db.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!session || !session.user || session.userId !== payload.sub) {
      return NextResponse.redirect(loginUrl);
    }
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return NextResponse.redirect(loginUrl);
    }

    const tokenMatches = await verifySecret(refreshToken, session.refreshTokenHash);
    if (!tokenMatches) {
      await revokeAuthSession(session.id);
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
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}
