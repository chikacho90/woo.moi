import { NextResponse } from "next/server";
import { sql } from "@/lib/smokemap/db";
import { getOrCreateAnonId } from "@/lib/smokemap/anon";
import { computeScores } from "@/lib/smokemap/status";
import type { Spot, Amenities } from "@/app/smokemap/types";

export const dynamic = "force-dynamic";

type SpotRow = {
  id: number;
  lat: number;
  lng: number;
  address: string | null;
  name: string | null;
  amenities: Amenities;
  is_official: boolean;
  source: "user" | "public_data" | "admin";
  smoker_comfortable: number;
  smoker_ok: number;
  smoker_inappropriate: number;
  resident_smoke: number;
  resident_butts: number;
  resident_sensitive: number;
  resident_other: number;
};

export async function GET() {
  try {
    const rows = (await sql`
      SELECT
        s.id, s.lat, s.lng, s.address, s.name, s.amenities,
        s.is_official, s.source,
        COUNT(*) FILTER (WHERE r.rating = 'comfortable')    AS smoker_comfortable,
        COUNT(*) FILTER (WHERE r.rating = 'ok')             AS smoker_ok,
        COUNT(*) FILTER (WHERE r.rating = 'inappropriate')  AS smoker_inappropriate,
        COUNT(*) FILTER (WHERE c.reason = 'smoke')           AS resident_smoke,
        COUNT(*) FILTER (WHERE c.reason = 'butts')           AS resident_butts,
        COUNT(*) FILTER (WHERE c.reason = 'sensitive_area')  AS resident_sensitive,
        COUNT(*) FILTER (WHERE c.reason = 'other' OR (c.id IS NOT NULL AND c.reason IS NULL)) AS resident_other
      FROM smokemap_spots s
      LEFT JOIN smokemap_smoker_ratings r ON r.spot_id = s.id
      LEFT JOIN smokemap_resident_complaints c ON c.spot_id = s.id
      GROUP BY s.id
    `) as unknown as SpotRow[];

    const spots: Spot[] = rows.map((r) => {
      const scores = computeScores(
        {
          comfortable: Number(r.smoker_comfortable),
          ok: Number(r.smoker_ok),
          inappropriate: Number(r.smoker_inappropriate),
        },
        {
          smoke: Number(r.resident_smoke),
          butts: Number(r.resident_butts),
          sensitive_area: Number(r.resident_sensitive),
          other: Number(r.resident_other),
        },
        r.is_official,
      );
      return {
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        address: r.address ?? undefined,
        name: r.name ?? undefined,
        amenities: r.amenities || {},
        isOfficial: r.is_official,
        source: r.source,
        status: scores.status,
        smokerScore: scores.smokerScore,
        residentScore: scores.residentScore,
        positiveCount: scores.positiveCount,
        complaintCount: scores.complaintCount,
      };
    });

    return NextResponse.json({ spots });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
      return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : null;
    const address = typeof body.address === "string" ? body.address.slice(0, 500) : null;
    const amenities = (body.amenities && typeof body.amenities === "object") ? body.amenities : {};

    const anonId = await getOrCreateAnonId();

    const [row] = (await sql`
      INSERT INTO smokemap_spots (lat, lng, name, address, amenities, is_official, source, creator_anon_id)
      VALUES (${lat}, ${lng}, ${name}, ${address}, ${JSON.stringify(amenities)}::jsonb, FALSE, 'user', ${anonId})
      RETURNING id
    `) as unknown as { id: number }[];

    return NextResponse.json({ id: row.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
