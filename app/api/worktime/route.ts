import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, makeLabsToken } from "@/lib/auth";

const GIST_RAW = "https://gist.githubusercontent.com/lookgitme/20d609ea970957106211499c99d7ee41/raw/worktime.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = process.env.LABS_SECRET;
  if (!secret) return NextResponse.json({ error: "no secret" }, { status: 401 });

  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const expected = await makeLabsToken(secret);
  if (token !== expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 캐시 우회를 위해 쿼리 추가
  const res = await fetch(`${GIST_RAW}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "fetch failed", status: res.status }, { status: 502 });
  const data = await res.json();
  return NextResponse.json(data);
}
