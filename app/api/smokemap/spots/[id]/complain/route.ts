import { NextResponse } from "next/server";
import { sql } from "@/lib/smokemap/db";
import { getOrCreateAnonId } from "@/lib/smokemap/anon";

export const dynamic = "force-dynamic";

const VALID_REASONS = new Set(["smoke", "butts", "sensitive_area", "other"]);

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

    const body = await request.json().catch(() => ({}));
    const reason = body.reason && VALID_REASONS.has(body.reason) ? body.reason : null;
    const detail = typeof body.detail === "string" ? body.detail.slice(0, 500) : null;

    const anonId = await getOrCreateAnonId();

    await sql`
      INSERT INTO smokemap_resident_complaints (spot_id, reason, detail, anon_id)
      VALUES (${id}, ${reason}, ${detail}, ${anonId})
      ON CONFLICT (spot_id, anon_id)
      DO UPDATE SET reason = EXCLUDED.reason, detail = EXCLUDED.detail, created_at = now()
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
