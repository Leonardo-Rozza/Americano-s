import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  tryVerifyAccessToken,
} from "@/lib/auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const session = accessToken ? await tryVerifyAccessToken(accessToken) : null;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const refreshRedirectUrl = new URL("/api/auth/refresh-redirect", request.url);
    refreshRedirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(refreshRedirectUrl);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/torneos",
    "/torneos/:path*",
    "/torneo",
    "/torneo/:path*",
  ],
};
