import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Role-based route protection
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Paths requiring authentication and roles
  const adminPaths = ["/admin", "/admin/", "/admin/users", "/admin/users/", "/stock", "/stock/", "/settings", "/settings/", "/journal", "/journal/"];
  const invoicePaths = ["/invoice", "/invoice/"];
  const repsBase = "/reps/";

  const requiresAdmin = adminPaths.some((p) => pathname === p || pathname.startsWith(p));
  const requiresInvoice = invoicePaths.some((p) => pathname === p || pathname.startsWith(p));
  const isRepProfile = pathname.startsWith(repsBase);

  if (!requiresAdmin && !requiresInvoice && !isRepProfile) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role as string | undefined;

  // If not logged in
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Authorization
  if (requiresAdmin) {
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  if (requiresInvoice) {
    if (role !== "ADMIN" && role !== "MANAGER" && role !== "EMPLOYEE") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  if (isRepProfile) {
    // Only ADMIN/MANAGER or the same user can view /reps/:id
    const parts = pathname.split("/").filter(Boolean); // ["reps", ":id", ...]
    const paramId = parts[1] || "";
    const userId = (token as any)?.sub as string | undefined;
    if (role === "ADMIN" || role === "MANAGER") {
      return NextResponse.next();
    }
    if (userId && paramId && userId === paramId) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/stock",
    "/stock/:path*",
    "/settings",
    "/settings/:path*",
    "/invoice",
    "/journal",
    "/journal/:path*",
    "/reps/:path*",
  ],
};
