#!/usr/bin/env node
// OSM Overpass API에서 서울·수도권 금연구역 후보 POI 벌크 시드
// - 학교·유치원·병원·공원(node/way center)
// - data.go.kr 대비: OSM은 인증키 없이 공개 접근 가능, 커버리지 서울+수도권 기준 수천 건
//
// 사용: DATABASE_URL=... node app/smokemap/nonsmoke-seed.mjs

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = neon(DATABASE_URL);

// 수도권 bbox: 인천 서쪽 ~ 양평 동쪽, 평택 남쪽 ~ 포천 북쪽
const BBOX = { south: 37.20, west: 126.60, north: 37.95, east: 127.30 };

const CATEGORY_RADIUS = {
  school: 30,
  kindergarten: 10,
  hospital: 50,
  park: 100,
  public: 40,
};

const OVERPASS = "https://overpass-api.de/api/interpreter";

function buildQuery(amenity) {
  const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  // node + way(center) 조회로 건물/영역 모두 커버
  return `[out:json][timeout:60];
(
  node["amenity"="${amenity}"](${b});
  way["amenity"="${amenity}"](${b});
);
out center;`;
}

function buildParkQuery() {
  const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  return `[out:json][timeout:60];
(
  node["leisure"="park"](${b});
  way["leisure"="park"](${b});
);
out center;`;
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

function coord(el) {
  if (el.type === "node") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function pickName(el) {
  const t = el.tags || {};
  return t.name || t["name:ko"] || t["name:en"] || null;
}

async function fetchCategory(amenity, category) {
  console.log(`[${category}] fetching...`);
  const query = category === "park" ? buildParkQuery() : buildQuery(amenity);
  const data = await overpass(query);
  const rows = [];
  for (const el of data.elements) {
    const c = coord(el);
    if (!c) continue;
    rows.push({
      osm_id: el.id,
      osm_type: el.type,
      name: pickName(el),
      category,
      lat: c.lat,
      lng: c.lng,
      radius_m: CATEGORY_RADIUS[category],
    });
  }
  console.log(`[${category}] fetched ${rows.length}`);
  return rows;
}

async function applySchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS smokemap_nonsmoke_zones (
      id SERIAL PRIMARY KEY,
      osm_id BIGINT,
      osm_type TEXT,
      name TEXT,
      category TEXT NOT NULL CHECK (category IN ('school','kindergarten','hospital','park','public')),
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      radius_m INT NOT NULL,
      source TEXT NOT NULL DEFAULT 'osm',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (osm_type, osm_id)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS smokemap_nonsmoke_latlng_idx ON smokemap_nonsmoke_zones (lat, lng)`;
  await sql`CREATE INDEX IF NOT EXISTS smokemap_nonsmoke_category_idx ON smokemap_nonsmoke_zones (category)`;
}

async function insertBatch(rows) {
  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const osmIds = chunk.map(r => r.osm_id);
    const osmTypes = chunk.map(r => r.osm_type);
    const names = chunk.map(r => r.name);
    const categories = chunk.map(r => r.category);
    const lats = chunk.map(r => r.lat);
    const lngs = chunk.map(r => r.lng);
    const radii = chunk.map(r => r.radius_m);
    try {
      await sql`
        INSERT INTO smokemap_nonsmoke_zones (osm_id, osm_type, name, category, lat, lng, radius_m)
        SELECT * FROM UNNEST(
          ${osmIds}::bigint[],
          ${osmTypes}::text[],
          ${names}::text[],
          ${categories}::text[],
          ${lats}::float8[],
          ${lngs}::float8[],
          ${radii}::int[]
        )
        ON CONFLICT (osm_type, osm_id) DO NOTHING
      `;
      inserted += chunk.length;
    } catch (e) {
      console.error("bulk insert err at offset", i, e.message);
    }
    console.log(`  inserted batch ending ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
  }
  return inserted;
}

async function main() {
  console.log("[smokemap nonsmoke seed] start");
  await applySchema();

  const schools = await fetchCategory("school", "school");
  const kinders = await fetchCategory("kindergarten", "kindergarten");
  const hospitals = await fetchCategory("hospital", "hospital");
  const parks = await fetchCategory("park", "park");

  const all = [...schools, ...kinders, ...hospitals, ...parks];
  console.log(`[smokemap nonsmoke seed] total fetched: ${all.length}`);

  const inserted = await insertBatch(all);
  const total = await sql`SELECT COUNT(*)::int AS c FROM smokemap_nonsmoke_zones`;
  console.log(`[smokemap nonsmoke seed] inserted ${inserted}, total rows: ${total[0].c}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
