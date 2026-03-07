import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, tryVerifyAccessToken } from "@/lib/auth/jwt";

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const session = accessToken ? await tryVerifyAccessToken(accessToken) : null;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
    "/api/torneo",
    "/api/torneo/:path*",
  ],
};
