import { ok, runApiRoute } from "@/lib/api";
import { clearAuthCookies, readCookieFromRequest, REFRESH_TOKEN_COOKIE, verifyRefreshToken } from "@/lib/auth/jwt";
import { revokeAuthSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  return runApiRoute(
    request,
    {
      operation: "auth.logout",
      fallbackMessage: "No se pudo cerrar sesión.",
    },
    async () => {
      assertSameOrigin(request);

      const refreshToken = readCookieFromRequest(request, REFRESH_TOKEN_COOKIE);
      if (refreshToken) {
        try {
          const payload = await verifyRefreshToken(refreshToken);
          await revokeAuthSession(payload.sid);
        } catch {
          // Limpiamos cookies incluso cuando el token es invalido.
        }
      }

      const response = ok({ loggedOut: true });
      clearAuthCookies(response);
      return response;
    },
  );
}
