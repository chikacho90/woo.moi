#!/usr/bin/env node
// 학교·유치원 폴리곤에 10m 법적 금연거리 버퍼 적용
// 의료기관은 건물 내부·부지 금연이라 건물 폴리곤 그대로 유지
//
// 실행: DATABASE_URL=... node app/smokemap/nonsmoke-buffer-seed.mjs

import { neon } from "@neondatabase/serverless";
import buffer from "@turf/buffer";
import { polygon as turfPoly } from "@turf/helpers";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = neon(DATABASE_URL);

const BUFFER_M = {
  school: 10,
  kindergarten: 10,
  hospital: 0, // 건물 그대로
};

function ensureClosed(ring) {
  if (ring.length < 1) return ring;
  const [a0, a1] = ring[0];
  const [b0, b1] = ring[ring.length - 1];
  if (a0 !== b0 || a1 !== b1) return [...ring, [a0, a1]];
  return ring;
}

function latlngToLnglat(coords) {
  // DB는 [lat,lng] 저장, turf/GeoJSON은 [lng,lat]
  return coords.map(([lat, lng]) => [lng, lat]);
}
function lnglatToLatlng(coords) {
  return coords.map(([lng, lat]) => [lat, lng]);
}

function bufferRing(ring, meters) {
  try {
    const gjCoords = ensureClosed(latlngToLnglat(ring));
    const poly = turfPoly([gjCoords]);
    const bf = buffer(poly, meters, { units: "meters" });
    if (!bf || !bf.geometry) return null;
    // 버퍼 결과가 MultiPolygon이 되는 경우는 드물지만 처리
    if (bf.geometry.type === "Polygon") {
      return lnglatToLatlng(bf.geometry.coordinates[0]);
    }
    if (bf.geometry.type === "MultiPolygon") {
      // 가장 큰 컴포넌트 외곽
      const biggest = bf.geometry.coordinates.reduce((a, b) =>
        (b[0].length > a[0].length ? b : a),
      );
      return lnglatToLatlng(biggest[0]);
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("[buffer seed] start");

  // 버퍼 대상 카테고리
  const rows = await sql`
    SELECT id, category, geometry
    FROM smokemap_nonsmoke_zones
    WHERE category IN ('school', 'kindergarten')
      AND geometry IS NOT NULL
      AND osm_type = 'way'
  `;
  console.log(`processing ${rows.length} polygons for buffering...`);

  let ok = 0, fail = 0;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    for (const r of chunk) {
      const meters = BUFFER_M[r.category] ?? 0;
      if (meters <= 0) continue;
      const buffered = bufferRing(r.geometry, meters);
      if (!buffered || buffered.length < 4) { fail++; continue; }
      try {
        await sql`
          UPDATE smokemap_nonsmoke_zones
          SET geometry = ${JSON.stringify(buffered)}::jsonb
          WHERE id = ${r.id}
        `;
        ok++;
      } catch (e) {
        fail++;
      }
    }
    console.log(`  processed ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }
  console.log(`[buffer seed] buffered ${ok}, failed ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
