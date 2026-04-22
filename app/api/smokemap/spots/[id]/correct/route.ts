import { NextResponse } from "next/server";
import { sql } from "@/lib/smokemap/db";
import { getOrCreateAnonId } from "@/lib/smokemap/anon";

export const dynamic = "force-dynamic";

const MAX_DEVIATION_M = 200; // 클러스터 중심 대비 이 이상 튀는 제보는 이상치로 배제

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
      return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
    }

    // 스팟 존재 확인
    const [spot] = (await sql`
      SELECT id, lat, lng FROM smokemap_spots WHERE id = ${id} LIMIT 1
    `) as unknown as { id: number; lat: number; lng: number }[];
    if (!spot) return NextResponse.json({ error: "spot not found" }, { status: 404 });

    // 수정 제안이 원래 위치에서 너무 멀면 거부 (의심)
    if (haversine(spot.lat, spot.lng, lat, lng) > 300) {
      return NextResponse.json(
        { error: "수정 제안 위치가 기존 위치에서 너무 멀어요 (300m 이내만)" },
        { status: 400 },
      );
    }

    const anonId = await getOrCreateAnonId();

    // upsert — 같은 익명 ID는 1건만 유지
    await sql`
      INSERT INTO smokemap_spot_corrections (spot_id, lat, lng, anon_id)
      VALUES (${id}, ${lat}, ${lng}, ${anonId})
      ON CONFLICT (spot_id, anon_id)
      DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, created_at = now()
    `;

    // 모든 correction 조회
    const corrections = (await sql`
      SELECT lat, lng FROM smokemap_spot_corrections WHERE spot_id = ${id}
    `) as unknown as { lat: number; lng: number }[];

    // 위치 계산:
    // - 1건: 그 값 그대로
    // - 2건+: centroid 계산 후 centroid에서 MAX_DEVIATION_M 초과 건 제외하고 재평균
    let newLat: number, newLng: number, usedCount: number;
    if (corrections.length === 1) {
      newLat = corrections[0].lat;
      newLng = corrections[0].lng;
      usedCount = 1;
    } else {
      const centroidLat = corrections.reduce((a, c) => a + c.lat, 0) / corrections.length;
      const centroidLng = corrections.reduce((a, c) => a + c.lng, 0) / corrections.length;
      const inliers = corrections.filter(
        (c) => haversine(centroidLat, centroidLng, c.lat, c.lng) <= MAX_DEVIATION_M,
      );
      const pool = inliers.length >= 2 ? inliers : corrections;
      newLat = pool.reduce((a, c) => a + c.lat, 0) / pool.length;
      newLng = pool.reduce((a, c) => a + c.lng, 0) / pool.length;
      usedCount = pool.length;
    }

    // 스팟 좌표 업데이트
    await sql`
      UPDATE smokemap_spots SET lat = ${newLat}, lng = ${newLng} WHERE id = ${id}
    `;

    return NextResponse.json({
      ok: true,
      total_corrections: corrections.length,
      used_count: usedCount,
      new_location: { lat: newLat, lng: newLng },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
