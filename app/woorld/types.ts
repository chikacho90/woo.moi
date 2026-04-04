// ── 카드 상태 ──
export type CardStatus = "pool" | "placed" | "locked";

// ── 카테고리 ──
export type CardCategory =
  | "transport"
  | "accommodation"
  | "activity"
  | "food"
  | "chill"
  | "errand";

// ── 시간대 ──
export type SlotType = "오전" | "점심" | "오후" | "저녁" | "밤";

export const SLOT_TYPES: SlotType[] = ["오전", "점심", "오후", "저녁", "밤"];

// ── 카테고리 컬러 ──
export const CATEGORY_COLORS: Record<
  CardCategory,
  { bg: string; text: string; label: string }
> = {
  transport: { bg: "#f1efe8", text: "#5f5e5a", label: "교통" },
  accommodation: { bg: "#fbeaf0", text: "#993556", label: "숙소" },
  activity: { bg: "#e1f5ee", text: "#0f6e56", label: "액티비티" },
  food: { bg: "#faeeda", text: "#854f0b", label: "식사" },
  chill: { bg: "#eeedfe", text: "#534ab7", label: "힐링" },
  errand: { bg: "#e6f1fb", text: "#185fa5", label: "기타" },
};

// ── 카드 ──
export interface Card {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: CardCategory;
  tags: { label: string; color: string; bg: string }[];
  compatibleSlots: SlotType[];
  compatibleAreas: string[];
  recommendedDayIndex?: number[];
  recommendedSlot?: SlotType;
  estimatedMinutes?: number;
  externalUrl?: string;
  requiresReservation?: boolean;
  reservationStatus?: "none" | "pending" | "confirmed";
}

// ── 날짜 ──
export interface TripDay {
  id: string;
  index: number;
  date: string | null;
  label: string;
  area: string;
  color: string;
}

// ── 배치 ──
export interface Placement {
  cardId: string;
  slotKey: string; // "dayId::slotType"
  status: "placed" | "locked";
  order: number;
}

// ── slotKey 유틸 ──
export function makeSlotKey(dayId: string, slot: SlotType): string {
  return `${dayId}::${slot}`;
}

export function parseSlotKey(key: string): { dayId: string; slot: SlotType } {
  const idx = key.indexOf("::");
  return { dayId: key.slice(0, idx), slot: key.slice(idx + 2) as SlotType };
}

// ── UI 상태 ──
export interface UIState {
  mode: "idle" | "dragging" | "slot-selecting" | "card-selecting";
  activeCardId: string | null;
  activeSlotKey: string | null;
  categoryFilter: string; // "all" | CardCategory
}

// ── 전체 상태 ──
export interface PlannerState {
  days: TripDay[];
  cards: Card[];
  placements: Placement[];
  ui: UIState;
}

// ── 추천 레벨 ──
export type Recommendation = "none" | "compatible" | "recommended" | "ideal";

// ── 날짜 프리셋 컬러 ──
export const DAY_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

// ── 위치 옵션 ──
export const AREA_OPTIONS = ["any", "시내", "리조트", "공항"];
