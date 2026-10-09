import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/constants";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/verify",
  "/blocked",
  "/forgot-password",
  "/admin/login",
  "/favicon.ico",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/public")) return true;
  if (pathname.startsWith("/api/auth/session")) return true;
  if (pathname.startsWith("/api/admin/login")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isPublic(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const adminSessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie && !adminSessionCookie) {
    const url = req.nextUrl.clone();
    if (pathname.startsWith("/admin")) {
      url.pathname = "/admin/login";
    } else {
      url.pathname = "/login";
    }
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
