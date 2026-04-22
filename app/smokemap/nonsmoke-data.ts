// 큐레이션된 주요 금연구역 샘플
// 전국 표준데이터는 OpenAPI 인증키 필요 — 추후 API 연동 시 교체.
// 현재는 서울 주요 학교/병원/어린이공원을 수기로 반영.

export type NonSmokeCategory = "school" | "kindergarten" | "hospital" | "park" | "public" | "street";

export type NonSmokeZone = {
  id: string;
  name: string;
  category: NonSmokeCategory;
  lat: number;
  lng: number;
  radiusM: number;   // 반경 (m)
  finePenalty?: string; // "10만원 과태료" 등
};

export const CATEGORY_COLOR: Record<NonSmokeCategory, string> = {
  school: "#f59e0b",     // amber
  kindergarten: "#fb923c",   // orange
  hospital: "#ef4444",   // red
  park: "#84cc16",       // lime
  public: "#6366f1",     // indigo
  street: "#db2777",     // pink/rose — 금연거리 구분
};

export const CATEGORY_LABEL: Record<NonSmokeCategory, string> = {
  school: "학교/어린이보호",
  kindergarten: "유치원",
  hospital: "의료기관 주변",
  park: "공원/어린이공원",
  public: "공공기관 주변",
  street: "금연거리",
};

export const NONSMOKE_ZONES: NonSmokeZone[] = [
  // 학교 (어린이보호구역 포함, 반경 10~30m)
  { id: "sch-daechi", name: "대치초등학교", category: "school", lat: 37.4990, lng: 127.0619, radiusM: 30, finePenalty: "10만원 과태료" },
  { id: "sch-hwimun", name: "휘문고등학교", category: "school", lat: 37.4939, lng: 127.0607, radiusM: 30, finePenalty: "10만원 과태료" },
  { id: "sch-yeoksam", name: "역삼초등학교", category: "school", lat: 37.5019, lng: 127.0417, radiusM: 30, finePenalty: "10만원 과태료" },
  { id: "sch-hongik", name: "홍익대학교", category: "school", lat: 37.5511, lng: 126.9259, radiusM: 50, finePenalty: "10만원 과태료" },
  { id: "sch-seoul-univ", name: "서울대학교", category: "school", lat: 37.4602, lng: 126.9520, radiusM: 100, finePenalty: "10만원 과태료" },
  { id: "sch-yonsei", name: "연세대학교", category: "school", lat: 37.5651, lng: 126.9383, radiusM: 80, finePenalty: "10만원 과태료" },
  { id: "sch-korea", name: "고려대학교", category: "school", lat: 37.5906, lng: 127.0324, radiusM: 80, finePenalty: "10만원 과태료" },
  { id: "sch-konkuk", name: "건국대학교", category: "school", lat: 37.5425, lng: 127.0770, radiusM: 60, finePenalty: "10만원 과태료" },
  { id: "sch-sangmyung", name: "상명대학교", category: "school", lat: 37.6024, lng: 126.9551, radiusM: 60, finePenalty: "10만원 과태료" },
  { id: "sch-ewha", name: "이화여자대학교", category: "school", lat: 37.5619, lng: 126.9464, radiusM: 60, finePenalty: "10만원 과태료" },

  // 의료기관 (주변 50m 금연구역)
  { id: "hos-snu", name: "서울대학교병원", category: "hospital", lat: 37.5800, lng: 126.9993, radiusM: 60, finePenalty: "10만원 과태료" },
  { id: "hos-samsung", name: "삼성서울병원", category: "hospital", lat: 37.4880, lng: 127.0857, radiusM: 60, finePenalty: "10만원 과태료" },
  { id: "hos-asan", name: "서울아산병원", category: "hospital", lat: 37.5273, lng: 127.1091, radiusM: 60, finePenalty: "10만원 과태료" },
  { id: "hos-severance", name: "세브란스병원", category: "hospital", lat: 37.5623, lng: 126.9405, radiusM: 60, finePenalty: "10만원 과태료" },
  { id: "hos-stmarys", name: "서울성모병원", category: "hospital", lat: 37.5014, lng: 127.0049, radiusM: 50, finePenalty: "10만원 과태료" },
  { id: "hos-gangnamsev", name: "강남세브란스병원", category: "hospital", lat: 37.4926, lng: 127.0470, radiusM: 50, finePenalty: "10만원 과태료" },
  { id: "hos-konkuk-med", name: "건국대학교병원", category: "hospital", lat: 37.5404, lng: 127.0738, radiusM: 50, finePenalty: "10만원 과태료" },
  { id: "hos-korea-med", name: "고려대학교의료원(안암)", category: "hospital", lat: 37.5871, lng: 127.0262, radiusM: 50, finePenalty: "10만원 과태료" },

  // 공원
  { id: "park-children-seoul", name: "어린이대공원", category: "park", lat: 37.5485, lng: 127.0810, radiusM: 120, finePenalty: "10만원 과태료" },
  { id: "park-seoulforest", name: "서울숲", category: "park", lat: 37.5443, lng: 127.0374, radiusM: 150, finePenalty: "10만원 과태료" },
  { id: "park-yeouido", name: "여의도공원", category: "park", lat: 37.5264, lng: 126.9266, radiusM: 150, finePenalty: "10만원 과태료" },
  { id: "park-namsan", name: "남산공원 정상부", category: "park", lat: 37.5512, lng: 126.9882, radiusM: 200, finePenalty: "10만원 과태료" },
  { id: "park-olympic", name: "올림픽공원", category: "park", lat: 37.5206, lng: 127.1214, radiusM: 200, finePenalty: "10만원 과태료" },
  { id: "park-ttukseom", name: "뚝섬한강공원 일부", category: "park", lat: 37.5308, lng: 127.0668, radiusM: 120, finePenalty: "10만원 과태료" },

  // 공공기관 (버스정류장·지하철 출구 주변 10m는 너무 작아 렌더 불가 → 주요 정부청사 등만)
  { id: "pub-seoul-city", name: "서울특별시청", category: "public", lat: 37.5666, lng: 126.9784, radiusM: 40, finePenalty: "10만원 과태료" },
  { id: "pub-gov-sejong", name: "정부서울청사", category: "public", lat: 37.5753, lng: 126.9768, radiusM: 40, finePenalty: "10만원 과태료" },
  { id: "pub-gangnam-gu", name: "강남구청", category: "public", lat: 37.5172, lng: 127.0473, radiusM: 30, finePenalty: "10만원 과태료" },
  { id: "pub-nat-lib", name: "국립중앙도서관", category: "public", lat: 37.4981, lng: 127.0060, radiusM: 40, finePenalty: "10만원 과태료" },
];
