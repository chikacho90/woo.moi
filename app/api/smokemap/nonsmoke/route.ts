import { NextResponse } from "next/server";
import { sql } from "@/lib/smokemap/db";

export const dynamic = "force-dynamic";

type ZoneRow = {
  id: number;
  name: string | null;
  category: "school" | "kindergarten" | "hospital" | "park" | "public" | "street";
  lat: number;
  lng: number;
  radius_m: number;
  geometry: [number, number][] | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sw = url.searchParams.get("sw")?.split(",").map(Number);
    const ne = url.searchParams.get("ne")?.split(",").map(Number);

    let rows: ZoneRow[];
    if (
      sw && ne &&
      sw.length === 2 && ne.length === 2 &&
      sw.every(Number.isFinite) && ne.every(Number.isFinite)
    ) {
      const [s, w] = sw;
      const [n, e] = ne;
      rows = (await sql`
        SELECT id, name, category, lat, lng, radius_m, geometry
        FROM smokemap_nonsmoke_zones
        WHERE lat BETWEEN ${s} AND ${n} AND lng BETWEEN ${w} AND ${e}
        LIMIT 2000
      `) as unknown as ZoneRow[];
    } else {
      rows = (await sql`
        SELECT id, name, category, lat, lng, radius_m, geometry
        FROM smokemap_nonsmoke_zones
        LIMIT 2000
      `) as unknown as ZoneRow[];
    }

    return NextResponse.json({ zones: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
