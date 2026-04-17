import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, makeSiteToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const secret = process.env.SITE_SECRET;
  if (!secret) return NextResponse.json({ error: "misconfigured" }, { status: 500 });

  const { password } = await req.json();
  if (password !== secret) {
    return NextResponse.json({ error: "wrong" }, { status: 401 });
  }

  const token = await makeSiteToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
