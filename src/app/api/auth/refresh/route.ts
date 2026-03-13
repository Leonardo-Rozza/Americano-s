import { ApiError, ok, runApiRoute } from "@/lib/api";
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
import { assertSameOrigin } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  return runApiRoute(
    request,
    {
      operation: "auth.refresh",
      fallbackMessage: "No se pudo refrescar la sesión.",
    },
    async (context) => {
      assertSameOrigin(request);

      const refreshToken = readCookieFromRequest(request, REFRESH_TOKEN_COOKIE);
      if (!refreshToken) {
        throw new ApiError("No autenticado.", 401);
      }

      const payload = await verifyRefreshToken(refreshToken);
      const session = await db.authSession.findUnique({
        where: { id: payload.sid },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      if (!session || !session.user || session.userId !== payload.sub) {
        throw new ApiError("Sesión inválida.", 401);
      }
      if (session.revokedAt) {
        throw new ApiError("Sesión revocada.", 401);
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        throw new ApiError("Sesión expirada.", 401);
      }

      const tokenMatches = await verifySecret(refreshToken, session.refreshTokenHash);
      if (!tokenMatches) {
        await revokeAuthSession(session.id);
        throw new ApiError("Sesión inválida.", 401);
      }

      context.userId = session.user.id;
      const accessToken = await signAccessToken({
        userId: session.user.id,
        username: session.user.username,
      });
      const nextRefreshToken = await signRefreshToken({
        userId: session.user.id,
        sessionId: session.id,
      });

      await rotateAuthSession({
        sessionId: session.id,
        refreshToken: nextRefreshToken,
      });

      const response = ok({ refreshed: true });
      setAuthCookies(response, accessToken, nextRefreshToken);
      return response;
    },
  );
}
