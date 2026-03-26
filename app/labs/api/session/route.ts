import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, makeLabsToken } from "@/lib/auth";

export async function GET() {
  const secret = process.env.LABS_SECRET;
  if (!secret) return NextResponse.json({ authed: false });

  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const expected = await makeLabsToken(secret);

  return NextResponse.json({ authed: token === expected });
}
