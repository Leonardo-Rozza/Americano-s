import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  ACCESS_TOKEN_COOKIE,
  type AccessTokenPayload,
  readCookieFromRequest,
  verifyAccessToken,
} from "@/lib/auth/jwt";
import { assertSameOrigin } from "@/lib/auth/csrf";

export type AuthUser = {
  userId: string;
  username: string;
};

function mapPayloadToUser(payload: AccessTokenPayload): AuthUser {
  return {
    userId: payload.sub,
    username: payload.username,
  };
}

export async function requireApiAuth(request: Request): Promise<AuthUser> {
  assertSameOrigin(request);

  const token = readCookieFromRequest(request, ACCESS_TOKEN_COOKIE);
  if (!token) {
    throw new ApiError("No autenticado.", 401);
  }

  try {
    const payload = await verifyAccessToken(token);
    return mapPayloadToUser(payload);
  } catch {
    throw new ApiError("Sesion invalida o expirada.", 401);
  }
}

export async function requirePageAuth(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const payload = await verifyAccessToken(token);
    return mapPayloadToUser(payload);
  } catch {
    redirect("/login");
  }
}
