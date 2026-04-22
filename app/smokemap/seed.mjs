#!/usr/bin/env node
// 서울·수도권 주요 흡연구역 시드
// 사용: DATABASE_URL=... node app/smokemap/seed.mjs
// - 기존 테스트 4개 삭제 후 실제 참고용 스팟 삽입
// - source='admin', is_official=true 로 표시 (유저 제보와 구분)

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const SPOTS = [
  // 서울 - 강남권
  { name: "강남역 2번 출구 흡연구역", address: "서울 강남구 역삼동", lat: 37.4984, lng: 127.0278, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "강남역 10번 출구 흡연구역", address: "서울 강남구 역삼동", lat: 37.4978, lng: 127.0281, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "역삼역 4번 출구 흡연장", address: "서울 강남구 역삼동", lat: 37.5002, lng: 127.0361, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "선릉역 3번 출구 흡연구역", address: "서울 강남구 삼성동", lat: 37.5043, lng: 127.0492, amenities: { ashtray: true, roof: true, size: "medium" } },
  { name: "삼성역 5번 출구 흡연장", address: "서울 강남구 삼성동", lat: 37.5088, lng: 127.0630, amenities: { ashtray: true, chair: true, roof: true, size: "large" } },
  { name: "코엑스 동문 흡연부스", address: "서울 강남구 영동대로", lat: 37.5125, lng: 127.0589, amenities: { ashtray: true, chair: true, roof: true, size: "large" } },
  { name: "신사역 8번 출구 흡연구역", address: "서울 강남구 신사동", lat: 37.5163, lng: 127.0202, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "양재역 7번 출구 흡연장", address: "서울 서초구 양재동", lat: 37.4849, lng: 127.0341, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "교대역 14번 출구 흡연구역", address: "서울 서초구 서초동", lat: 37.4939, lng: 127.0138, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "서초역 1번 출구 흡연장", address: "서울 서초구 서초동", lat: 37.4918, lng: 127.0077, amenities: { ashtray: true, roof: false, size: "small" } },

  // 서울 - 도심권
  { name: "시청역 4번 출구 흡연부스", address: "서울 중구 정동", lat: 37.5655, lng: 126.9779, amenities: { ashtray: true, chair: false, roof: true, size: "medium" } },
  { name: "광화문 광장 흡연구역", address: "서울 종로구 세종대로", lat: 37.5710, lng: 126.9766, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "종로3가역 15번 출구 흡연장", address: "서울 종로구 종로3가", lat: 37.5712, lng: 126.9917, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "을지로3가역 11번 출구 흡연구역", address: "서울 중구 을지로3가", lat: 37.5661, lng: 126.9921, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "DDP 동쪽 흡연부스", address: "서울 중구 을지로7가", lat: 37.5663, lng: 127.0093, amenities: { ashtray: true, chair: true, roof: true, size: "medium" } },
  { name: "서울역 3번 출구 흡연장", address: "서울 중구 봉래동2가", lat: 37.5547, lng: 126.9707, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "명동역 8번 출구 흡연구역", address: "서울 중구 명동", lat: 37.5602, lng: 126.9860, amenities: { ashtray: true, roof: false, size: "small" } },

  // 서울 - 서부권
  { name: "홍대입구역 9번 출구 흡연구역", address: "서울 마포구 서교동", lat: 37.5572, lng: 126.9245, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "합정역 7번 출구 흡연장", address: "서울 마포구 합정동", lat: 37.5496, lng: 126.9137, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "신촌역 2번 출구 흡연구역", address: "서울 서대문구 창천동", lat: 37.5558, lng: 126.9368, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "여의도역 1번 출구 흡연부스", address: "서울 영등포구 여의도동", lat: 37.5219, lng: 126.9244, amenities: { ashtray: true, chair: true, roof: true, size: "medium" } },
  { name: "여의도공원 흡연구역", address: "서울 영등포구 여의공원로", lat: 37.5264, lng: 126.9266, amenities: { ashtray: true, chair: true, roof: false, size: "medium" } },
  { name: "영등포역 1번 출구 흡연장", address: "서울 영등포구 영등포동", lat: 37.5159, lng: 126.9078, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "구로디지털단지역 1번 출구 흡연구역", address: "서울 구로구 구로동", lat: 37.4854, lng: 126.9015, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "상암 DMC 흡연부스", address: "서울 마포구 상암동", lat: 37.5796, lng: 126.8890, amenities: { ashtray: true, chair: true, roof: true, size: "large" } },

  // 서울 - 동부권
  { name: "성수역 1번 출구 흡연구역", address: "서울 성동구 성수동1가", lat: 37.5446, lng: 127.0556, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "왕십리역 5번 출구 흡연장", address: "서울 성동구 행당동", lat: 37.5613, lng: 127.0379, amenities: { ashtray: true, roof: false, size: "small" } },
  { name: "건대입구역 5번 출구 흡연구역", address: "서울 광진구 화양동", lat: 37.5404, lng: 127.0697, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "잠실역 8번 출구 흡연장", address: "서울 송파구 잠실동", lat: 37.5133, lng: 127.1000, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "잠실 롯데월드타워 후문 흡연부스", address: "서울 송파구 올림픽로", lat: 37.5125, lng: 127.1025, amenities: { ashtray: true, chair: true, roof: true, size: "large" } },
  { name: "청량리역 1번 출구 흡연구역", address: "서울 동대문구 청량리동", lat: 37.5800, lng: 127.0472, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "이태원역 2번 출구 흡연구역", address: "서울 용산구 이태원동", lat: 37.5345, lng: 126.9944, amenities: { ashtray: true, roof: false, size: "small" } },

  // 서울 - 북부권
  { name: "노원역 5번 출구 흡연장", address: "서울 노원구 상계동", lat: 37.6542, lng: 127.0614, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "수유역 3번 출구 흡연구역", address: "서울 강북구 수유동", lat: 37.6378, lng: 127.0253, amenities: { ashtray: true, roof: false, size: "small" } },

  // 경기 - 분당·판교
  { name: "판교역 1번 출구 흡연부스", address: "경기 성남시 분당구 삼평동", lat: 37.3951, lng: 127.1112, amenities: { ashtray: true, chair: true, roof: true, size: "large" } },
  { name: "서현역 3번 출구 흡연장", address: "경기 성남시 분당구 서현동", lat: 37.3850, lng: 127.1235, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "정자역 5번 출구 흡연구역", address: "경기 성남시 분당구 정자동", lat: 37.3670, lng: 127.1086, amenities: { ashtray: true, roof: false, size: "small" } },

  // 경기 - 수원·일산
  { name: "수원역 4번 출구 흡연장", address: "경기 수원시 팔달구 매산로1가", lat: 37.2659, lng: 127.0000, amenities: { ashtray: true, roof: false, size: "medium" } },
  { name: "킨텍스 제2전시장 흡연부스", address: "경기 고양시 일산서구 대화동", lat: 37.6768, lng: 126.7355, amenities: { ashtray: true, chair: true, roof: true, size: "large" } },
];

async function main() {
  console.log(`[smokemap seed] connected. inserting ${SPOTS.length} spots...`);

  // 기존 테스트 시드 4건 삭제 (id 1~4)
  await sql`DELETE FROM smokemap_spots WHERE id <= 4 AND source IN ('public_data', 'user')`;
  console.log("[smokemap seed] removed test seed rows (id<=4)");

  let inserted = 0;
  for (const s of SPOTS) {
    // 동일 이름+좌표 중복 방지
    const dup = await sql`
      SELECT id FROM smokemap_spots
      WHERE name = ${s.name} AND ABS(lat - ${s.lat}) < 0.0001 AND ABS(lng - ${s.lng}) < 0.0001
      LIMIT 1
    `;
    if (dup.length > 0) continue;
    await sql`
      INSERT INTO smokemap_spots (lat, lng, name, address, amenities, is_official, source, creator_anon_id)
      VALUES (${s.lat}, ${s.lng}, ${s.name}, ${s.address}, ${JSON.stringify(s.amenities)}::jsonb, TRUE, 'admin', 'seed')
    `;
    inserted++;
  }
  console.log(`[smokemap seed] inserted ${inserted} / ${SPOTS.length}`);

  const total = await sql`SELECT COUNT(*)::int AS c FROM smokemap_spots`;
  console.log(`[smokemap seed] total spots in DB: ${total[0].c}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
