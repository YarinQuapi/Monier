import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Next.js 16 renamed Middleware to Proxy (same runtime behavior).
// This performs an *optimistic* check only (reads the session from the
// signed JWT cookie) to pre-filter unauthenticated/unauthorized users and
// avoid a page flash. Each protected page/route handler still performs its
// own authoritative check via `auth()` — see the Data Access Layer pattern
// in src/lib/authorization.ts.

const ADMIN_ROUTES = ["/admin"];
const AUTHENTICATED_ROUTES = [
  "/dashboard",
  "/income",
  "/purchases",
  "/payment-methods",
  "/subscriptions",
  "/admin",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthenticatedRoute = AUTHENTICATED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isAuthenticatedRoute && !session?.user) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session?.user && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
