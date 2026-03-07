import { fromUnknownError, ok } from "@/lib/api";
import { clearAuthCookies, readCookieFromRequest, REFRESH_TOKEN_COOKIE, verifyRefreshToken } from "@/lib/auth/jwt";
import { revokeAuthSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    return fromUnknownError(error, "No se pudo cerrar sesión.");
  }
}
