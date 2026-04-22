#!/usr/bin/env node
// OSM 금연구역 후보 POI를 폴리곤 geometry 포함해서 재시드
// - node(amenity=*)는 point → 기존 반경 circle 유지
// - way(amenity=*, leisure=park)는 polygon → 실제 건물/부지 모양 렌더
// - 기존 source='osm' 데이터 삭제 후 전면 교체
//
// 사용: DATABASE_URL=... node app/smokemap/nonsmoke-geom-seed.mjs

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = neon(DATABASE_URL);

const BBOX = { south: 37.20, west: 126.60, north: 37.95, east: 127.30 };

const CATEGORY_RADIUS = {
  school: 30,
  kindergarten: 10,
  hospital: 50,
  park: 100,
  public: 40,
};

const OVERPASS = "https://overpass-api.de/api/interpreter";

function buildQuery(selector) {
  const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  return `[out:json][timeout:90];
(
  node${selector}(${b});
  way${selector}(${b});
);
out geom;`;
}

async function overpass(query) {
  const url = `${OVERPASS}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "smokemap-seed/1.0 (woo.moi)",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`overpass ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function pickName(el) {
  const t = el.tags || {};
  return t.name || t["name:ko"] || t["name:en"] || null;
}

// way geometry의 center (lat/lng 단순 평균)
function centroidOfGeom(geom) {
  let sumLat = 0, sumLng = 0;
  for (const p of geom) { sumLat += p.lat; sumLng += p.lon; }
  return { lat: sumLat / geom.length, lng: sumLng / geom.length };
}

async function fetchCategory(selector, category) {
  console.log(`[${category}] fetching with geom...`);
  const data = await overpass(buildQuery(selector));
  const rows = [];
  for (const el of data.elements) {
    let lat, lng, geometry = null;
    if (el.type === "node") {
      lat = el.lat; lng = el.lon;
    } else if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 3) {
      // way는 polygon 후보 — coord 배열 저장 ([[lat,lng],...])
      geometry = el.geometry.map(p => [p.lat, p.lon]);
      const c = centroidOfGeom(el.geometry);
      lat = c.lat; lng = c.lng;
    } else {
      continue; // skip short ways or odd types
    }
    rows.push({
      osm_id: el.id,
      osm_type: el.type,
      name: pickName(el),
      category,
      lat, lng,
      radius_m: CATEGORY_RADIUS[category],
      geometry,
    });
  }
  console.log(`[${category}] fetched ${rows.length} (${rows.filter(r => r.geometry).length} with geom)`);
  return rows;
}

async function applySchema() {
  await sql`ALTER TABLE smokemap_nonsmoke_zones ADD COLUMN IF NOT EXISTS geometry JSONB`;
}

async function wipeOsmRows() {
  const r = await sql`DELETE FROM smokemap_nonsmoke_zones WHERE source = 'osm' RETURNING id`;
  console.log(`wiped ${r.length} osm rows`);
}

async function insertBatch(rows) {
  let inserted = 0;
  const CHUNK = 300;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const osmIds = chunk.map(r => r.osm_id);
    const osmTypes = chunk.map(r => r.osm_type);
    const names = chunk.map(r => r.name);
    const categories = chunk.map(r => r.category);
    const lats = chunk.map(r => r.lat);
    const lngs = chunk.map(r => r.lng);
    const radii = chunk.map(r => r.radius_m);
    const geoms = chunk.map(r => r.geometry ? JSON.stringify(r.geometry) : null);
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
      console.error("bulk insert err at offset", i, e.message);
    }
    console.log(`  inserted ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
  }
  return inserted;
}

async function main() {
  console.log("[geom seed] start");
  await applySchema();
  await wipeOsmRows();

  const schools = await fetchCategory('["amenity"="school"]', "school");
  const kinders = await fetchCategory('["amenity"="kindergarten"]', "kindergarten");
  const hospitals = await fetchCategory('["amenity"="hospital"]', "hospital");
  const parks = await fetchCategory('["leisure"="park"]', "park");

  const all = [...schools, ...kinders, ...hospitals, ...parks];
  console.log(`[geom seed] total fetched: ${all.length}`);

  await insertBatch(all);
  const total = await sql`SELECT
    (SELECT COUNT(*)::int FROM smokemap_nonsmoke_zones) AS total,
    (SELECT COUNT(*)::int FROM smokemap_nonsmoke_zones WHERE geometry IS NOT NULL) AS with_geom
  `;
  console.log(`[geom seed] total ${total[0].total}, with geometry ${total[0].with_geom}`);
}

main().catch(e => { console.error(e); process.exit(1); });
