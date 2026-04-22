#!/usr/bin/env node
// 서울 주요 금연거리 OSM 폴리라인 시드
// - 기존 'curated' street 21건 삭제 후, OSM highway way를 이름으로 검색해 실제 도로 geometry 확보
// - 각 way segment별로 1행 insert (같은 거리 이름이 여러 segment로 나뉠 수 있음)
// 실행: DATABASE_URL=... node app/smokemap/nonsmoke-streets-osm-seed.mjs

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = neon(DATABASE_URL);

const BBOX = { south: 37.20, west: 126.60, north: 37.95, east: 127.30 };

// 조례 기반 공식 지정 + 관습적으로 금연거리로 간주되는 주요 도로들
const STREETS = [
  "강남대로",
  "테헤란로",
  "가로수길",
  "반포대로",
  "언주로",
  "압구정로",
  "세종대로",
  "종로",
  "을지로",
  "청계천로",
  "신촌로",
  "이태원로",
  "경리단길",
  "양화로",
  "서교로",
  "퇴계로",
  "명동길",
  "남산공원길",
];

const OVERPASS = "https://overpass-api.de/api/interpreter";

async function overpass(query) {
  const url = `${OVERPASS}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "smokemap-seed/1.0 (woo.moi)" },
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  return res.json();
}

function centroidOfGeom(geom) {
  let sumLat = 0, sumLng = 0;
  for (const p of geom) { sumLat += p.lat; sumLng += p.lon; }
  return { lat: sumLat / geom.length, lng: sumLng / geom.length };
}

async function fetchStreet(name) {
  const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const q = `[out:json][timeout:60];way[name="${name}"][highway](${b});out geom;`;
  const data = await overpass(q);
  const ways = [];
  for (const el of data.elements) {
    if (el.type !== "way" || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const geom = el.geometry.map(p => [p.lat, p.lon]);
    const c = centroidOfGeom(el.geometry);
    ways.push({
      osm_id: el.id,
      osm_type: "way",
      name: `${name} 금연거리`,
      category: "street",
      lat: c.lat, lng: c.lng,
      radius_m: 50, // fallback if rendering as circle
      geometry: geom,
    });
  }
  return ways;
}

async function main() {
  console.log("[osm streets seed] start");

  // 기존 curated circles 삭제
  const del = await sql`DELETE FROM smokemap_nonsmoke_zones WHERE category = 'street' RETURNING id`;
  console.log(`cleared ${del.length} existing street rows`);

  const all = [];
  for (const name of STREETS) {
    try {
      const ways = await fetchStreet(name);
      console.log(`  ${name}: ${ways.length} segments`);
      all.push(...ways);
    } catch (e) {
      console.error(`  ${name}: error`, e.message);
    }
  }
  console.log(`[osm streets seed] total segments: ${all.length}`);

  // 삽입 (chunked)
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const osmIds = chunk.map(r => r.osm_id);
    const osmTypes = chunk.map(r => r.osm_type);
    const names = chunk.map(r => r.name);
    const categories = chunk.map(r => r.category);
    const lats = chunk.map(r => r.lat);
    const lngs = chunk.map(r => r.lng);
    const radii = chunk.map(r => r.radius_m);
    const geoms = chunk.map(r => JSON.stringify(r.geometry));
    try {
      await sql`
        INSERT INTO smokemap_nonsmoke_zones (osm_id, osm_type, name, category, lat, lng, radius_m, source, geometry)
        SELECT osm_id, osm_type, name, category, lat, lng, radius_m, 'osm', geometry::jsonb
        FROM UNNEST(
          ${osmIds}::bigint[],
          ${osmTypes}::text[],
          ${names}::text[],
          ${categories}::text[],
          ${lats}::float8[],
          ${lngs}::float8[],
          ${radii}::int[],
          ${geoms}::text[]
        ) AS t(osm_id, osm_type, name, category, lat, lng, radius_m, geometry)
        ON CONFLICT (osm_type, osm_id) DO NOTHING
      `;
      inserted += chunk.length;
    } catch (e) {
      console.error("insert err:", e.message);
    }
  }
  const total = await sql`SELECT COUNT(*)::int AS c FROM smokemap_nonsmoke_zones WHERE category='street'`;
  console.log(`[osm streets seed] inserted ${inserted}, street total: ${total[0].c}`);
}

main().catch(e => { console.error(e); process.exit(1); });
