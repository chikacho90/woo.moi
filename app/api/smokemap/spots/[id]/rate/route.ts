import { NextResponse } from "next/server";
import { sql } from "@/lib/smokemap/db";
import { getOrCreateAnonId } from "@/lib/smokemap/anon";

export const dynamic = "force-dynamic";

const VALID = new Set(["comfortable", "ok", "inappropriate"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (!isFinite(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const rating = String(body.rating || "");
    if (!VALID.has(rating)) {
      return NextResponse.json({ error: "invalid rating" }, { status: 400 });
    }

    const anonId = await getOrCreateAnonId();

    await sql`
      INSERT INTO smokemap_smoker_ratings (spot_id, rating, anon_id)
      VALUES (${id}, ${rating}, ${anonId})
      ON CONFLICT (spot_id, anon_id)
      DO UPDATE SET rating = EXCLUDED.rating, created_at = now()
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
