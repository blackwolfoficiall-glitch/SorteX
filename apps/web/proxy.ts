import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/server";

export function proxy(request: NextRequest) {
  const isAdminPublicRoute =
    request.nextUrl.pathname === "/admin/login" ||
    request.nextUrl.pathname.startsWith("/admin/convite/");
  if (isAdminPublicRoute) return NextResponse.next();

  const authenticated = Boolean(
    request.cookies.get(ACCESS_COOKIE)?.value ||
    request.cookies.get(REFRESH_COOKIE)?.value,
  );

  if (!authenticated) {
    const loginUrl = new URL(
      request.nextUrl.pathname.startsWith("/admin")
        ? "/admin/login"
        : "/login",
      request.url,
    );
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/perfil/:path*",
    "/comprador/:path*",
    "/dashboard/:path*",
    "/criar/:path*",
    "/organizador/:path*",
    "/admin/:path*",
  ],
};
