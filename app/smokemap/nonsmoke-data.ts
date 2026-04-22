// 금연구역 카테고리 (DB 기준, API에서 반환)
// 현재 보수적 범위 — 국민건강증진법상 명확히 금연인 시설만 표시:
// - school: 학교 경계 10m 이내 도로 법적 금연
// - kindergarten: 유치원·어린이집 경계 10m 금연
// - hospital: 의료기관 건물 및 부지 법적 금연
// 공원은 지자체 지정 공원만 금연이라 표시 제외.
// 금연거리는 조례 기반 부분 구간만 지정 — 정확 데이터 (data.go.kr 15013192)
// 붙기 전까지 표시 제외.

export type NonSmokeCategory = "school" | "kindergarten" | "hospital";

// 모든 금연구역은 통일된 붉은색
const NONSMOKE_RED = "#dc2626";
export const CATEGORY_COLOR: Record<NonSmokeCategory, string> = {
  school: NONSMOKE_RED,
  kindergarten: NONSMOKE_RED,
  hospital: NONSMOKE_RED,
};

export const CATEGORY_LABEL: Record<NonSmokeCategory, string> = {
  school: "학교/어린이보호",
  kindergarten: "유치원",
  hospital: "의료기관",
};
