import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, makeSiteToken } from "@/lib/auth";

export async function GET() {
  const secret = process.env.SITE_SECRET;
  if (!secret) return NextResponse.json({ authed: false });

  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const expected = await makeSiteToken(secret);

  return NextResponse.json({ authed: token === expected });
}
