import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, makeLabsToken } from "@/lib/auth";

const PROTECTED = ["/woorld"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes handle their own auth
  if (pathname.includes("/api/")) return NextResponse.next();

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const secret = process.env.LABS_SECRET;
  if (!secret) return NextResponse.redirect(new URL("/login", req.url));

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await makeLabsToken(secret);

  if (token !== expected) return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/woorld/:path*"],
};
