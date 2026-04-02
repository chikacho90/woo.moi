/* ─── Built-in Destination Database ─── */

import type { CardCategory, SlotType } from "../types";

export type TravelStyle = "food" | "activity" | "relax" | "sightseeing" | "shopping" | "nature" | "culture";

export interface Spot {
  name: string;
  emoji: string;
  category: CardCategory;
  slots: SlotType[];
  description: string;
  estimatedMinutes: number;
  style: TravelStyle;
}

export interface Destination {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  emoji: string;
  budgetPerDayKRW: { solo: number; couple: number };
  recommendedNights: number[];
  styles: TravelStyle[];
  spots: Spot[];
}

export const DESTINATIONS: Destination[] = [
  // ─── Japan ───
  {
    id: "osaka",
    name: "오사카",
    nameEn: "Osaka",
    country: "일본",
    emoji: "🇯🇵",
    budgetPerDayKRW: { solo: 15, couple: 25 },
    recommendedNights: [2, 3, 4],
    styles: ["food", "shopping", "culture"],
    spots: [
      { name: "도톤보리", emoji: "🏮", category: "activity", slots: ["오후", "저녁"], description: "오사카의 상징적인 번화가", estimatedMinutes: 120, style: "sightseeing" },
      { name: "오사카성", emoji: "🏯", category: "activity", slots: ["오전", "오후"], description: "역사적인 오사카 성곽", estimatedMinutes: 90, style: "culture" },
      { name: "구로몬 시장", emoji: "🦀", category: "food", slots: ["오전", "점심"], description: "오사카의 부엌, 신선한 해산물", estimatedMinutes: 90, style: "food" },
      { name: "신세카이", emoji: "🗼", category: "activity", slots: ["오후", "저녁"], description: "츠텐카쿠 타워와 꼬치카츠", estimatedMinutes: 120, style: "food" },
      { name: "유니버설 스튜디오", emoji: "🎢", category: "activity", slots: ["오전", "오후"], description: "USJ 테마파크", estimatedMinutes: 480, style: "activity" },
      { name: "이치란 라멘", emoji: "🍜", category: "food", slots: ["점심", "저녁"], description: "유명 돈코츠 라멘", estimatedMinutes: 45, style: "food" },
      { name: "신사이바시", emoji: "🛍", category: "errand", slots: ["오후", "저녁"], description: "쇼핑 거리", estimatedMinutes: 120, style: "shopping" },
      { name: "난바 야시장", emoji: "🍢", category: "food", slots: ["저녁", "밤"], description: "길거리 음식 탐방", estimatedMinutes: 90, style: "food" },
    ],
  },
  {
    id: "tokyo",
    name: "도쿄",
    nameEn: "Tokyo",
    country: "일본",
    emoji: "🇯🇵",
    budgetPerDayKRW: { solo: 18, couple: 30 },
    recommendedNights: [3, 4, 5],
    styles: ["shopping", "culture", "food", "sightseeing"],
    spots: [
      { name: "시부야 스크램블", emoji: "🚶", category: "activity", slots: ["오후", "저녁"], description: "세계에서 가장 유명한 교차로", estimatedMinutes: 60, style: "sightseeing" },
      { name: "아사쿠사 센소지", emoji: "⛩️", category: "activity", slots: ["오전", "오후"], description: "도쿄 최고의 사찰", estimatedMinutes: 90, style: "culture" },
      { name: "츠키지 시장", emoji: "🍣", category: "food", slots: ["오전", "점심"], description: "신선한 초밥과 해산물", estimatedMinutes: 90, style: "food" },
      { name: "하라주쿠", emoji: "🎀", category: "errand", slots: ["오후"], description: "트렌디한 패션 거리", estimatedMinutes: 120, style: "shopping" },
      { name: "도쿄 타워", emoji: "🗼", category: "activity", slots: ["오후", "저녁"], description: "도쿄의 랜드마크", estimatedMinutes: 60, style: "sightseeing" },
      { name: "아키하바라", emoji: "🎮", category: "errand", slots: ["오후", "저녁"], description: "전자제품과 오타쿠 문화", estimatedMinutes: 120, style: "shopping" },
      { name: "신주쿠 교엔", emoji: "🌸", category: "chill", slots: ["오전", "오후"], description: "도심 속 아름다운 정원", estimatedMinutes: 90, style: "nature" },
      { name: "이자카야 골목", emoji: "🍶", category: "food", slots: ["저녁", "밤"], description: "일본식 선술집 체험", estimatedMinutes: 120, style: "food" },
    ],
  },
  {
    id: "fukuoka",
    name: "후쿠오카",
    nameEn: "Fukuoka",
    country: "일본",
    emoji: "🇯🇵",
    budgetPerDayKRW: { solo: 12, couple: 20 },
    recommendedNights: [2, 3],
    styles: ["food", "relax", "culture"],
    spots: [
      { name: "나카스 야타이", emoji: "🍜", category: "food", slots: ["저녁", "밤"], description: "후쿠오카 대표 포장마차", estimatedMinutes: 90, style: "food" },
      { name: "다자이후 텐만구", emoji: "⛩️", category: "activity", slots: ["오전", "오후"], description: "학문의 신을 모신 신사", estimatedMinutes: 90, style: "culture" },
      { name: "캐널시티", emoji: "🏬", category: "errand", slots: ["오후", "저녁"], description: "대형 복합 쇼핑몰", estimatedMinutes: 120, style: "shopping" },
      { name: "하카타 라멘", emoji: "🍥", category: "food", slots: ["점심", "저녁"], description: "본고장 하카타 라멘", estimatedMinutes: 45, style: "food" },
      { name: "오호리 공원", emoji: "🌿", category: "chill", slots: ["오전", "오후"], description: "호수가 있는 아름다운 공원", estimatedMinutes: 60, style: "nature" },
      { name: "텐진 지하상가", emoji: "🛍", category: "errand", slots: ["오후"], description: "일본 최대 지하 쇼핑가", estimatedMinutes: 90, style: "shopping" },
    ],
  },
  {
    id: "kyoto",
    name: "교토",
    nameEn: "Kyoto",
    country: "일본",
    emoji: "🇯🇵",
    budgetPerDayKRW: { solo: 15, couple: 25 },
    recommendedNights: [2, 3, 4],
    styles: ["culture", "sightseeing", "nature"],
    spots: [
      { name: "기요미즈데라", emoji: "⛩️", category: "activity", slots: ["오전", "오후"], description: "교토 대표 사찰", estimatedMinutes: 90, style: "culture" },
      { name: "후시미 이나리", emoji: "🦊", category: "activity", slots: ["오전", "오후"], description: "천 개의 도리이 신사", estimatedMinutes: 120, style: "sightseeing" },
      { name: "아라시야마 대나무숲", emoji: "🎋", category: "activity", slots: ["오전", "오후"], description: "신비로운 대나무 산책로", estimatedMinutes: 90, style: "nature" },
      { name: "기온 거리", emoji: "🏮", category: "activity", slots: ["오후", "저녁"], description: "게이샤 문화의 거리", estimatedMinutes: 90, style: "culture" },
      { name: "니시키 시장", emoji: "🍡", category: "food", slots: ["오전", "점심"], description: "교토의 부엌", estimatedMinutes: 60, style: "food" },
      { name: "금각사", emoji: "✨", category: "activity", slots: ["오전", "오후"], description: "황금빛 사찰", estimatedMinutes: 60, style: "culture" },
      { name: "교토 마차 체험", emoji: "🍵", category: "food", slots: ["오후"], description: "전통 말차 다도", estimatedMinutes: 60, style: "culture" },
    ],
  },
  {
    id: "sapporo",
    name: "삿포로",
    nameEn: "Sapporo",
    country: "일본",
    emoji: "🇯🇵",
    budgetPerDayKRW: { solo: 15, couple: 25 },
    recommendedNights: [3, 4],
    styles: ["food", "nature", "activity"],
    spots: [
      { name: "오도리 공원", emoji: "🌲", category: "chill", slots: ["오전", "오후"], description: "삿포로 중심부 공원", estimatedMinutes: 60, style: "nature" },
      { name: "삿포로 라멘 골목", emoji: "🍜", category: "food", slots: ["점심", "저녁"], description: "미소 라멘의 본고장", estimatedMinutes: 60, style: "food" },
      { name: "오타루 운하", emoji: "🏮", category: "activity", slots: ["오후", "저녁"], description: "낭만적인 운하 마을", estimatedMinutes: 180, style: "sightseeing" },
      { name: "삿포로 맥주 박물관", emoji: "🍺", category: "activity", slots: ["오후"], description: "맥주 시음과 역사", estimatedMinutes: 90, style: "culture" },
      { name: "니세코 스키", emoji: "⛷️", category: "activity", slots: ["오전", "오후"], description: "세계적인 파우더 스노우", estimatedMinutes: 360, style: "activity" },
      { name: "징기스칸", emoji: "🥩", category: "food", slots: ["저녁"], description: "북해도 양고기 BBQ", estimatedMinutes: 90, style: "food" },
    ],
  },
  {
    id: "okinawa",
    name: "오키나와",
    nameEn: "Okinawa",
    country: "일본",
    emoji: "🇯🇵",
    budgetPerDayKRW: { solo: 15, couple: 25 },
    recommendedNights: [3, 4, 5],
    styles: ["nature", "relax", "activity"],
    spots: [
      { name: "추라우미 수족관", emoji: "🐠", category: "activity", slots: ["오전", "오후"], description: "세계 최대 규모 수족관", estimatedMinutes: 180, style: "sightseeing" },
      { name: "만자모", emoji: "🌊", category: "activity", slots: ["오전", "오후"], description: "코끼리 바위 절벽", estimatedMinutes: 60, style: "nature" },
      { name: "나미노우에 비치", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "에메랄드빛 해변", estimatedMinutes: 180, style: "relax" },
      { name: "슈리성", emoji: "🏯", category: "activity", slots: ["오전", "오후"], description: "류큐 왕국의 성", estimatedMinutes: 90, style: "culture" },
      { name: "스노클링", emoji: "🤿", category: "activity", slots: ["오전", "오후"], description: "열대 바다 스노클링", estimatedMinutes: 180, style: "activity" },
      { name: "국제거리", emoji: "🛍", category: "errand", slots: ["오후", "저녁"], description: "오키나와 최대 번화가", estimatedMinutes: 120, style: "shopping" },
    ],
  },

  // ─── Southeast Asia ───
  {
    id: "bangkok",
    name: "방콕",
    nameEn: "Bangkok",
    country: "태국",
    emoji: "🇹🇭",
    budgetPerDayKRW: { solo: 8, couple: 12 },
    recommendedNights: [3, 4, 5],
    styles: ["food", "shopping", "culture", "relax"],
    spots: [
      { name: "왓 프라깨우", emoji: "🛕", category: "activity", slots: ["오전"], description: "에메랄드 부처 사원", estimatedMinutes: 120, style: "culture" },
      { name: "왓 아룬", emoji: "🌅", category: "activity", slots: ["오전", "오후"], description: "새벽의 사원", estimatedMinutes: 60, style: "sightseeing" },
      { name: "짜뚜짝 시장", emoji: "🏪", category: "errand", slots: ["오전", "오후"], description: "세계 최대 주말 시장", estimatedMinutes: 180, style: "shopping" },
      { name: "카오산 로드", emoji: "🎉", category: "activity", slots: ["저녁", "밤"], description: "배낭여행자의 성지", estimatedMinutes: 120, style: "activity" },
      { name: "팟타이 & 망고스틴", emoji: "🍜", category: "food", slots: ["점심", "저녁"], description: "태국 길거리 음식", estimatedMinutes: 60, style: "food" },
      { name: "태국 마사지", emoji: "💆", category: "chill", slots: ["오후", "저녁"], description: "전통 타이 마사지", estimatedMinutes: 120, style: "relax" },
      { name: "아이콘시암", emoji: "🏬", category: "errand", slots: ["오후", "저녁"], description: "고급 리버사이드 쇼핑몰", estimatedMinutes: 120, style: "shopping" },
    ],
  },
  {
    id: "danang",
    name: "다낭",
    nameEn: "Da Nang",
    country: "베트남",
    emoji: "🇻🇳",
    budgetPerDayKRW: { solo: 7, couple: 10 },
    recommendedNights: [3, 4, 5],
    styles: ["relax", "food", "nature", "sightseeing"],
    spots: [
      { name: "미케 비치", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "다낭 대표 해변", estimatedMinutes: 180, style: "relax" },
      { name: "바나힐", emoji: "🌉", category: "activity", slots: ["오전", "오후"], description: "골든 브릿지와 테마파크", estimatedMinutes: 300, style: "sightseeing" },
      { name: "호이안 올드타운", emoji: "🏮", category: "activity", slots: ["오후", "저녁"], description: "유네스코 고대 도시", estimatedMinutes: 180, style: "culture" },
      { name: "반미 & 쌀국수", emoji: "🍲", category: "food", slots: ["점심", "저녁"], description: "베트남 로컬 음식", estimatedMinutes: 60, style: "food" },
      { name: "오행산", emoji: "⛰️", category: "activity", slots: ["오전", "오후"], description: "대리석 산과 동굴 사원", estimatedMinutes: 120, style: "nature" },
      { name: "한시장", emoji: "🏪", category: "errand", slots: ["오전", "오후"], description: "다낭 최대 전통시장", estimatedMinutes: 90, style: "shopping" },
    ],
  },
  {
    id: "bali",
    name: "발리",
    nameEn: "Bali",
    country: "인도네시아",
    emoji: "🇮🇩",
    budgetPerDayKRW: { solo: 8, couple: 12 },
    recommendedNights: [4, 5, 6],
    styles: ["relax", "nature", "culture", "activity"],
    spots: [
      { name: "우붓 라이스 테라스", emoji: "🌾", category: "activity", slots: ["오전", "오후"], description: "계단식 논 트레킹", estimatedMinutes: 120, style: "nature" },
      { name: "울루와뚜 사원", emoji: "🛕", category: "activity", slots: ["오후"], description: "절벽 위 사원과 일몰", estimatedMinutes: 120, style: "culture" },
      { name: "발리 스파", emoji: "🧖", category: "chill", slots: ["오후", "저녁"], description: "럭셔리 발리 스파", estimatedMinutes: 120, style: "relax" },
      { name: "쿠타 비치", emoji: "🏄", category: "activity", slots: ["오전", "오후"], description: "서핑과 해변", estimatedMinutes: 180, style: "activity" },
      { name: "몽키 포레스트", emoji: "🐒", category: "activity", slots: ["오전", "오후"], description: "원숭이 숲 산책", estimatedMinutes: 90, style: "nature" },
      { name: "나시고렝 & 사테", emoji: "🍛", category: "food", slots: ["점심", "저녁"], description: "발리 전통 음식", estimatedMinutes: 60, style: "food" },
    ],
  },
  {
    id: "singapore",
    name: "싱가포르",
    nameEn: "Singapore",
    country: "싱가포르",
    emoji: "🇸🇬",
    budgetPerDayKRW: { solo: 18, couple: 28 },
    recommendedNights: [3, 4],
    styles: ["food", "sightseeing", "shopping"],
    spots: [
      { name: "마리나 베이 샌즈", emoji: "🏙️", category: "activity", slots: ["오후", "저녁"], description: "싱가포르 랜드마크", estimatedMinutes: 120, style: "sightseeing" },
      { name: "가든스 바이 더 베이", emoji: "🌳", category: "activity", slots: ["오후", "저녁"], description: "미래형 정원 테마파크", estimatedMinutes: 120, style: "nature" },
      { name: "센토사 섬", emoji: "🏝️", category: "activity", slots: ["오전", "오후"], description: "테마파크와 해변", estimatedMinutes: 300, style: "activity" },
      { name: "차이나타운 호커센터", emoji: "🍜", category: "food", slots: ["점심", "저녁"], description: "미슐랭 길거리 음식", estimatedMinutes: 60, style: "food" },
      { name: "오차드 로드", emoji: "🛍", category: "errand", slots: ["오후"], description: "싱가포르 최대 쇼핑 거리", estimatedMinutes: 120, style: "shopping" },
      { name: "칠리크랩", emoji: "🦀", category: "food", slots: ["저녁"], description: "싱가포르 대표 음식", estimatedMinutes: 90, style: "food" },
    ],
  },
  {
    id: "cebu",
    name: "세부",
    nameEn: "Cebu",
    country: "필리핀",
    emoji: "🇵🇭",
    budgetPerDayKRW: { solo: 7, couple: 10 },
    recommendedNights: [3, 4, 5],
    styles: ["activity", "relax", "nature"],
    spots: [
      { name: "오슬롭 고래상어", emoji: "🐋", category: "activity", slots: ["오전"], description: "고래상어와 스노클링", estimatedMinutes: 180, style: "activity" },
      { name: "카와산 폭포", emoji: "💧", category: "activity", slots: ["오전", "오후"], description: "캐녀닝과 폭포 점프", estimatedMinutes: 240, style: "activity" },
      { name: "보홀 초콜릿힐스", emoji: "⛰️", category: "activity", slots: ["오전", "오후"], description: "독특한 원뿔형 언덕", estimatedMinutes: 300, style: "nature" },
      { name: "막탄 해변 리조트", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "리조트 힐링", estimatedMinutes: 240, style: "relax" },
      { name: "아일랜드 호핑", emoji: "🚤", category: "activity", slots: ["오전", "오후"], description: "섬 투어와 스노클링", estimatedMinutes: 360, style: "activity" },
      { name: "망고 & 레촌", emoji: "🍖", category: "food", slots: ["점심", "저녁"], description: "세부 대표 음식", estimatedMinutes: 60, style: "food" },
    ],
  },

  // ─── Korea ───
  {
    id: "jeju",
    name: "제주",
    nameEn: "Jeju",
    country: "한국",
    emoji: "🇰🇷",
    budgetPerDayKRW: { solo: 10, couple: 15 },
    recommendedNights: [2, 3, 4],
    styles: ["nature", "food", "relax", "sightseeing"],
    spots: [
      { name: "성산일출봉", emoji: "🌄", category: "activity", slots: ["오전"], description: "유네스코 화산 봉우리", estimatedMinutes: 120, style: "nature" },
      { name: "만장굴", emoji: "🕳️", category: "activity", slots: ["오전", "오후"], description: "유네스코 용암 동굴", estimatedMinutes: 60, style: "nature" },
      { name: "협재 해변", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "에메랄드빛 해변", estimatedMinutes: 120, style: "relax" },
      { name: "흑돼지 거리", emoji: "🐷", category: "food", slots: ["점심", "저녁"], description: "제주 흑돼지 맛집", estimatedMinutes: 90, style: "food" },
      { name: "한라산 트레킹", emoji: "🥾", category: "activity", slots: ["오전", "오후"], description: "한라산 등반", estimatedMinutes: 360, style: "activity" },
      { name: "카페 투어", emoji: "☕", category: "food", slots: ["오후"], description: "제주 감성 카페", estimatedMinutes: 60, style: "relax" },
      { name: "우도", emoji: "🏝️", category: "activity", slots: ["오전", "오후"], description: "소의 섬 자전거 투어", estimatedMinutes: 240, style: "nature" },
    ],
  },
  {
    id: "busan",
    name: "부산",
    nameEn: "Busan",
    country: "한국",
    emoji: "🇰🇷",
    budgetPerDayKRW: { solo: 8, couple: 12 },
    recommendedNights: [2, 3],
    styles: ["food", "sightseeing", "nature"],
    spots: [
      { name: "해운대 해변", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "부산 대표 해변", estimatedMinutes: 120, style: "relax" },
      { name: "감천문화마을", emoji: "🎨", category: "activity", slots: ["오전", "오후"], description: "알록달록 벽화 마을", estimatedMinutes: 90, style: "sightseeing" },
      { name: "자갈치시장", emoji: "🐟", category: "food", slots: ["점심"], description: "부산 대표 수산시장", estimatedMinutes: 90, style: "food" },
      { name: "광안리 & 광안대교", emoji: "🌉", category: "activity", slots: ["저녁", "밤"], description: "야경 명소", estimatedMinutes: 90, style: "sightseeing" },
      { name: "태종대", emoji: "🌊", category: "activity", slots: ["오전", "오후"], description: "해안 절벽 관광지", estimatedMinutes: 120, style: "nature" },
      { name: "돼지국밥", emoji: "🥘", category: "food", slots: ["점심", "저녁"], description: "부산 소울 푸드", estimatedMinutes: 45, style: "food" },
    ],
  },
  {
    id: "gangneung",
    name: "강릉",
    nameEn: "Gangneung",
    country: "한국",
    emoji: "🇰🇷",
    budgetPerDayKRW: { solo: 8, couple: 12 },
    recommendedNights: [1, 2],
    styles: ["nature", "food", "relax"],
    spots: [
      { name: "경포 해변", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "강릉 대표 해변", estimatedMinutes: 120, style: "relax" },
      { name: "강릉 커피거리", emoji: "☕", category: "food", slots: ["오후"], description: "안목 해변 카페 거리", estimatedMinutes: 90, style: "food" },
      { name: "정동진", emoji: "🌅", category: "activity", slots: ["오전"], description: "해돋이 명소", estimatedMinutes: 60, style: "nature" },
      { name: "오죽헌", emoji: "🏛️", category: "activity", slots: ["오전", "오후"], description: "율곡 이이 생가", estimatedMinutes: 60, style: "culture" },
      { name: "초당 순두부", emoji: "🥣", category: "food", slots: ["점심"], description: "강릉 명물 순두부", estimatedMinutes: 60, style: "food" },
    ],
  },
  {
    id: "yeosu",
    name: "여수",
    nameEn: "Yeosu",
    country: "한국",
    emoji: "🇰🇷",
    budgetPerDayKRW: { solo: 8, couple: 12 },
    recommendedNights: [1, 2],
    styles: ["nature", "food", "sightseeing"],
    spots: [
      { name: "여수 밤바다", emoji: "🌃", category: "activity", slots: ["저녁", "밤"], description: "해상 케이블카 야경", estimatedMinutes: 90, style: "sightseeing" },
      { name: "향일암", emoji: "⛩️", category: "activity", slots: ["오전"], description: "해돋이 명소 사찰", estimatedMinutes: 90, style: "culture" },
      { name: "돌산공원", emoji: "🌊", category: "chill", slots: ["오후", "저녁"], description: "돌산대교와 바다 전망", estimatedMinutes: 60, style: "nature" },
      { name: "여수 해산물", emoji: "🦞", category: "food", slots: ["점심", "저녁"], description: "갓김치 삼합, 게장", estimatedMinutes: 90, style: "food" },
      { name: "오동도", emoji: "🏝️", category: "activity", slots: ["오전", "오후"], description: "동백꽃 섬 산책", estimatedMinutes: 90, style: "nature" },
    ],
  },

  // ─── Europe ───
  {
    id: "paris",
    name: "파리",
    nameEn: "Paris",
    country: "프랑스",
    emoji: "🇫🇷",
    budgetPerDayKRW: { solo: 25, couple: 40 },
    recommendedNights: [4, 5, 6],
    styles: ["culture", "sightseeing", "food", "shopping"],
    spots: [
      { name: "에펠탑", emoji: "🗼", category: "activity", slots: ["오전", "오후", "저녁"], description: "파리의 상징", estimatedMinutes: 120, style: "sightseeing" },
      { name: "루브르 박물관", emoji: "🖼️", category: "activity", slots: ["오전", "오후"], description: "모나리자와 세계 명작", estimatedMinutes: 240, style: "culture" },
      { name: "몽마르뜨", emoji: "🎨", category: "activity", slots: ["오전", "오후"], description: "예술가의 언덕", estimatedMinutes: 120, style: "culture" },
      { name: "샹젤리제 거리", emoji: "🛍", category: "errand", slots: ["오후"], description: "세계적인 쇼핑 거리", estimatedMinutes: 120, style: "shopping" },
      { name: "크루아상 & 카페", emoji: "🥐", category: "food", slots: ["오전", "점심"], description: "파리지앵 브런치", estimatedMinutes: 60, style: "food" },
      { name: "센 강 크루즈", emoji: "🚢", category: "activity", slots: ["오후", "저녁"], description: "센 강 유람선", estimatedMinutes: 90, style: "sightseeing" },
      { name: "노트르담 주변", emoji: "⛪", category: "activity", slots: ["오전", "오후"], description: "시테 섬 산책", estimatedMinutes: 90, style: "culture" },
    ],
  },
  {
    id: "barcelona",
    name: "바르셀로나",
    nameEn: "Barcelona",
    country: "스페인",
    emoji: "🇪🇸",
    budgetPerDayKRW: { solo: 20, couple: 32 },
    recommendedNights: [3, 4, 5],
    styles: ["culture", "food", "sightseeing", "nature"],
    spots: [
      { name: "사그라다 파밀리아", emoji: "⛪", category: "activity", slots: ["오전", "오후"], description: "가우디의 걸작 성당", estimatedMinutes: 120, style: "culture" },
      { name: "구엘 공원", emoji: "🦎", category: "activity", slots: ["오전", "오후"], description: "가우디의 모자이크 공원", estimatedMinutes: 90, style: "sightseeing" },
      { name: "람블라스 거리", emoji: "🚶", category: "activity", slots: ["오후", "저녁"], description: "바르셀로나 중심 거리", estimatedMinutes: 90, style: "sightseeing" },
      { name: "보케리아 시장", emoji: "🍇", category: "food", slots: ["오전", "점심"], description: "신선한 과일과 하몽", estimatedMinutes: 60, style: "food" },
      { name: "바르셀로네타 해변", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "지중해 해변", estimatedMinutes: 120, style: "relax" },
      { name: "타파스 & 상그리아", emoji: "🍷", category: "food", slots: ["저녁", "밤"], description: "스페인 저녁 식사", estimatedMinutes: 120, style: "food" },
    ],
  },
  {
    id: "rome",
    name: "로마",
    nameEn: "Rome",
    country: "이탈리아",
    emoji: "🇮🇹",
    budgetPerDayKRW: { solo: 20, couple: 32 },
    recommendedNights: [3, 4, 5],
    styles: ["culture", "sightseeing", "food"],
    spots: [
      { name: "콜로세움", emoji: "🏛️", category: "activity", slots: ["오전", "오후"], description: "고대 로마 원형극장", estimatedMinutes: 120, style: "culture" },
      { name: "바티칸 박물관", emoji: "🖼️", category: "activity", slots: ["오전"], description: "시스티나 예배당", estimatedMinutes: 240, style: "culture" },
      { name: "트레비 분수", emoji: "⛲", category: "activity", slots: ["오전", "오후", "저녁"], description: "소원의 분수", estimatedMinutes: 30, style: "sightseeing" },
      { name: "판테온", emoji: "🏛️", category: "activity", slots: ["오전", "오후"], description: "고대 신전", estimatedMinutes: 45, style: "culture" },
      { name: "파스타 & 젤라토", emoji: "🍝", category: "food", slots: ["점심", "저녁"], description: "진짜 이탈리안 요리", estimatedMinutes: 90, style: "food" },
      { name: "스페인 계단", emoji: "📸", category: "activity", slots: ["오전", "오후"], description: "인생샷 명소", estimatedMinutes: 30, style: "sightseeing" },
    ],
  },
  {
    id: "london",
    name: "런던",
    nameEn: "London",
    country: "영국",
    emoji: "🇬🇧",
    budgetPerDayKRW: { solo: 25, couple: 40 },
    recommendedNights: [4, 5],
    styles: ["culture", "sightseeing", "shopping"],
    spots: [
      { name: "빅벤 & 웨스트민스터", emoji: "🕰️", category: "activity", slots: ["오전", "오후"], description: "런던의 상징", estimatedMinutes: 60, style: "sightseeing" },
      { name: "대영박물관", emoji: "🏛️", category: "activity", slots: ["오전", "오후"], description: "세계적인 무료 박물관", estimatedMinutes: 180, style: "culture" },
      { name: "타워 브릿지", emoji: "🌉", category: "activity", slots: ["오전", "오후"], description: "런던의 상징적 다리", estimatedMinutes: 60, style: "sightseeing" },
      { name: "버킹엄 궁전", emoji: "👑", category: "activity", slots: ["오전"], description: "근위병 교대식", estimatedMinutes: 60, style: "culture" },
      { name: "피시 앤 칩스", emoji: "🐟", category: "food", slots: ["점심", "저녁"], description: "영국 대표 음식", estimatedMinutes: 60, style: "food" },
      { name: "옥스포드 거리", emoji: "🛍", category: "errand", slots: ["오후"], description: "런던 최대 쇼핑 거리", estimatedMinutes: 120, style: "shopping" },
    ],
  },
  {
    id: "prague",
    name: "프라하",
    nameEn: "Prague",
    country: "체코",
    emoji: "🇨🇿",
    budgetPerDayKRW: { solo: 12, couple: 18 },
    recommendedNights: [3, 4],
    styles: ["culture", "sightseeing", "food"],
    spots: [
      { name: "카를교", emoji: "🌉", category: "activity", slots: ["오전", "오후", "저녁"], description: "프라하의 상징적 다리", estimatedMinutes: 60, style: "sightseeing" },
      { name: "프라하 성", emoji: "🏰", category: "activity", slots: ["오전", "오후"], description: "세계 최대 성곽 단지", estimatedMinutes: 180, style: "culture" },
      { name: "구시가지 광장", emoji: "⏰", category: "activity", slots: ["오전", "오후"], description: "천문시계와 광장", estimatedMinutes: 90, style: "sightseeing" },
      { name: "체코 맥주", emoji: "🍺", category: "food", slots: ["저녁", "밤"], description: "맥주 1위 소비국", estimatedMinutes: 90, style: "food" },
      { name: "뜨르들로", emoji: "🥯", category: "food", slots: ["오후"], description: "체코 전통 빵 디저트", estimatedMinutes: 30, style: "food" },
      { name: "존 레논 벽", emoji: "🎨", category: "activity", slots: ["오전", "오후"], description: "평화의 벽화", estimatedMinutes: 30, style: "culture" },
    ],
  },

  // ─── Others ───
  {
    id: "hawaii",
    name: "하와이",
    nameEn: "Hawaii",
    country: "미국",
    emoji: "🇺🇸",
    budgetPerDayKRW: { solo: 25, couple: 40 },
    recommendedNights: [5, 6, 7],
    styles: ["nature", "relax", "activity"],
    spots: [
      { name: "와이키키 비치", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "하와이 대표 해변", estimatedMinutes: 180, style: "relax" },
      { name: "다이아몬드 헤드", emoji: "🌋", category: "activity", slots: ["오전"], description: "화산 분화구 트레킹", estimatedMinutes: 120, style: "activity" },
      { name: "노스쇼어 서핑", emoji: "🏄", category: "activity", slots: ["오전", "오후"], description: "세계적인 서핑 스팟", estimatedMinutes: 180, style: "activity" },
      { name: "하나우마 베이", emoji: "🤿", category: "activity", slots: ["오전", "오후"], description: "스노클링 천국", estimatedMinutes: 180, style: "nature" },
      { name: "포케 & 로코모코", emoji: "🍲", category: "food", slots: ["점심", "저녁"], description: "하와이안 푸드", estimatedMinutes: 60, style: "food" },
      { name: "루아우 쇼", emoji: "🌺", category: "activity", slots: ["저녁"], description: "전통 하와이안 공연", estimatedMinutes: 180, style: "culture" },
    ],
  },
  {
    id: "guam",
    name: "괌",
    nameEn: "Guam",
    country: "미국",
    emoji: "🇬🇺",
    budgetPerDayKRW: { solo: 15, couple: 25 },
    recommendedNights: [3, 4],
    styles: ["relax", "activity", "shopping"],
    spots: [
      { name: "투몬 비치", emoji: "🏖️", category: "chill", slots: ["오전", "오후"], description: "괌 최고의 해변", estimatedMinutes: 180, style: "relax" },
      { name: "제트스키 & 파라세일링", emoji: "🚤", category: "activity", slots: ["오전", "오후"], description: "해양 액티비티", estimatedMinutes: 120, style: "activity" },
      { name: "차모로 야시장", emoji: "🏪", category: "food", slots: ["저녁"], description: "로컬 야시장", estimatedMinutes: 90, style: "food" },
      { name: "K마트 & 쇼핑", emoji: "🛍", category: "errand", slots: ["오후", "저녁"], description: "면세 쇼핑", estimatedMinutes: 120, style: "shopping" },
      { name: "사랑의 절벽", emoji: "🌊", category: "activity", slots: ["오전", "오후"], description: "괌 인기 전망대", estimatedMinutes: 60, style: "sightseeing" },
    ],
  },
  {
    id: "taipei",
    name: "타이베이",
    nameEn: "Taipei",
    country: "대만",
    emoji: "🇹🇼",
    budgetPerDayKRW: { solo: 10, couple: 15 },
    recommendedNights: [3, 4],
    styles: ["food", "culture", "shopping", "sightseeing"],
    spots: [
      { name: "타이베이 101", emoji: "🏙️", category: "activity", slots: ["오후", "저녁"], description: "대만의 랜드마크", estimatedMinutes: 90, style: "sightseeing" },
      { name: "지우펀", emoji: "🏮", category: "activity", slots: ["오후", "저녁"], description: "센과 치히로의 마을", estimatedMinutes: 180, style: "culture" },
      { name: "스린 야시장", emoji: "🍢", category: "food", slots: ["저녁", "밤"], description: "대만 최대 야시장", estimatedMinutes: 120, style: "food" },
      { name: "융캉제 딘타이펑", emoji: "🥟", category: "food", slots: ["점심", "저녁"], description: "소룽포의 원조", estimatedMinutes: 90, style: "food" },
      { name: "시먼딩", emoji: "🛍", category: "errand", slots: ["오후", "저녁"], description: "대만의 하라주쿠", estimatedMinutes: 120, style: "shopping" },
      { name: "중정기념당", emoji: "🏛️", category: "activity", slots: ["오전", "오후"], description: "위병 교대식", estimatedMinutes: 60, style: "culture" },
      { name: "버블티", emoji: "🧋", category: "food", slots: ["오후"], description: "대만 정통 버블티", estimatedMinutes: 30, style: "food" },
    ],
  },
];

export function findDestination(id: string): Destination | undefined {
  return DESTINATIONS.find(d => d.id === id);
}

export function searchDestinations(query: string): Destination[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return DESTINATIONS.filter(d =>
    d.name.includes(q) ||
    d.nameEn.toLowerCase().includes(q) ||
    d.country.includes(q)
  );
}

export function getDestinationsByBudget(budgetPerDay: number, companions: "solo" | "couple"): Destination[] {
  return DESTINATIONS.filter(d => d.budgetPerDayKRW[companions] <= budgetPerDay);
}

export function getDestinationsByStyle(styles: TravelStyle[]): Destination[] {
  if (styles.length === 0) return DESTINATIONS;
  return DESTINATIONS.filter(d =>
    styles.some(s => d.styles.includes(s))
  ).sort((a, b) => {
    const aMatch = styles.filter(s => a.styles.includes(s)).length;
    const bMatch = styles.filter(s => b.styles.includes(s)).length;
    return bMatch - aMatch;
  });
}

export function getTrendingDestinations(): Destination[] {
  return [
    DESTINATIONS.find(d => d.id === "osaka")!,
    DESTINATIONS.find(d => d.id === "tokyo")!,
    DESTINATIONS.find(d => d.id === "danang")!,
    DESTINATIONS.find(d => d.id === "bangkok")!,
    DESTINATIONS.find(d => d.id === "jeju")!,
    DESTINATIONS.find(d => d.id === "taipei")!,
  ];
}
