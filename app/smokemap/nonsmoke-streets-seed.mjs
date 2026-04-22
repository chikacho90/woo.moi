#!/usr/bin/env node
// 서울 주요 금연거리 수기 시드 (street 카테고리)
// OSM에는 ways[smoking=no][highway]가 0건이라 자동 수집 불가 → 지자체 공식 지정 거리 수기 반영
// 실제 지정 범위는 조례 기반이라 거리 단위로 달라, 대표 중심점 + 반경(m)으로 근사 표현

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = neon(DATABASE_URL);

// 카테고리 constraint 확장 (기존: school/kindergarten/hospital/park/public)
async function ensureStreetCategory() {
  // 기존 check constraint 갱신
  await sql`ALTER TABLE smokemap_nonsmoke_zones DROP CONSTRAINT IF EXISTS smokemap_nonsmoke_zones_category_check`;
  await sql`ALTER TABLE smokemap_nonsmoke_zones ADD CONSTRAINT smokemap_nonsmoke_zones_category_check
            CHECK (category IN ('school','kindergarten','hospital','park','public','street'))`;
}

const STREETS = [
  // 강남구·서초구
  { name: "강남대로 (강남역 일대) 금연거리", lat: 37.4980, lng: 127.0280, radius_m: 400 },
  { name: "테헤란로 강남역~역삼역 금연거리", lat: 37.5003, lng: 127.0330, radius_m: 500 },
  { name: "가로수길 금연거리", lat: 37.5194, lng: 127.0229, radius_m: 300 },
  { name: "반포대로 고속버스터미널 금연거리", lat: 37.5045, lng: 127.0048, radius_m: 250 },

  // 중구·종로구 (도심)
  { name: "명동 메인거리 금연거리", lat: 37.5636, lng: 126.9822, radius_m: 300 },
  { name: "종로 종각~종로5가 금연거리", lat: 37.5710, lng: 126.9889, radius_m: 600 },
  { name: "광화문광장 주변 금연거리", lat: 37.5725, lng: 126.9768, radius_m: 300 },
  { name: "서울로 7017 금연구간", lat: 37.5556, lng: 126.9720, radius_m: 500 },
  { name: "청계천 산책로 금연구간", lat: 37.5694, lng: 126.9880, radius_m: 800 },
  { name: "DDP 주변 금연거리", lat: 37.5666, lng: 127.0096, radius_m: 300 },

  // 마포구·서대문구
  { name: "홍대입구역 메인거리 금연거리", lat: 37.5560, lng: 126.9236, radius_m: 350 },
  { name: "신촌로 연세대 앞 금연거리", lat: 37.5571, lng: 126.9376, radius_m: 300 },

  // 용산구
  { name: "이태원로 메인거리 금연거리", lat: 37.5343, lng: 126.9944, radius_m: 400 },
  { name: "경리단길 금연거리", lat: 37.5405, lng: 126.9895, radius_m: 250 },

  // 영등포구
  { name: "여의도 IFC 주변 금연거리", lat: 37.5253, lng: 126.9258, radius_m: 300 },
  { name: "여의도 증권가 금연거리", lat: 37.5193, lng: 126.9268, radius_m: 400 },

  // 송파구·성동구
  { name: "잠실 롯데월드 주변 금연거리", lat: 37.5112, lng: 127.0980, radius_m: 400 },
  { name: "성수동 카페거리 금연거리", lat: 37.5445, lng: 127.0565, radius_m: 300 },

  // 관악구·동작구
  { name: "서울대입구역 샤로수길 금연거리", lat: 37.4819, lng: 126.9525, radius_m: 250 },
  { name: "노량진 수산시장 주변 금연거리", lat: 37.5134, lng: 126.9410, radius_m: 250 },

  // 성남·판교
  { name: "판교역 테크노밸리 금연거리", lat: 37.3951, lng: 127.1112, radius_m: 400 },
];

async function main() {
  console.log("[streets seed] start");
  await ensureStreetCategory();
  console.log("[streets seed] category constraint extended to include 'street'");

  let inserted = 0;
  for (const s of STREETS) {
    try {
      // 동일 이름 존재 시 스킵
      const dup = await sql`SELECT id FROM smokemap_nonsmoke_zones WHERE name = ${s.name} AND category = 'street' LIMIT 1`;
      if (dup.length > 0) continue;
      await sql`
        INSERT INTO smokemap_nonsmoke_zones (osm_id, osm_type, name, category, lat, lng, radius_m, source)
        VALUES (NULL, 'curated', ${s.name}, 'street', ${s.lat}, ${s.lng}, ${s.radius_m}, 'curated')
      `;
      inserted++;
    } catch (e) {
      console.error("insert err:", s.name, e.message);
    }
  }
  const total = await sql`SELECT COUNT(*)::int AS c FROM smokemap_nonsmoke_zones WHERE category='street'`;
  console.log(`[streets seed] inserted ${inserted}, streets total: ${total[0].c}`);
}

main().catch(e => { console.error(e); process.exit(1); });
