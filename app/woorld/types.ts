/* ─── Woorld Travel Planner — Types ─── */

export type CardStatus = "pool" | "placed" | "locked";
export type CardCategory = "transport" | "accommodation" | "activity" | "food" | "chill" | "errand";
export type SlotType = "오전" | "점심" | "오후" | "저녁" | "밤";
export type CompanionType = "solo" | "couple" | "friends" | "family";
export type TravelStyle = "food" | "activity" | "relax" | "sightseeing" | "shopping" | "nature" | "culture";

export const SLOT_TYPES: SlotType[] = ["오전", "점심", "오후", "저녁", "밤"];

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

export interface TripDay {
  id: string;
  index: number;
  date: string | null;
  label: string;
  area: string;
  color: string;
}

export interface Placement {
  cardId: string;
  slotKey: string; // "dayId-slotType"
  status: "placed" | "locked";
  order: number;
}

export type UIMode = "idle" | "dragging" | "slot-selecting" | "card-selecting";

export interface UIState {
  mode: UIMode;
  activeCardId: string | null;
  activeSlotKey: string | null;
  categoryFilter: string; // "all" | CardCategory
}

export interface PlannerState {
  days: TripDay[];
  cards: Card[];
  placements: Placement[];
  ui: UIState;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  note?: string;
  url?: string;
  addedAt: number;
}

export interface Memo {
  id: string;
  content: string;
  updatedAt: number;
}

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  currency: string;
  category: string;
  date?: string;
  note?: string;
}

export interface Trip {
  id: string;
  createdAt: number;
  destination?: string;
  destinationId?: string;
  startDate?: string | null;
  endDate?: string | null;
  nights?: number | null;
  companions: CompanionType;
  budget?: number | null; // 만원 단위
  styles: TravelStyle[];
  days: TripDay[];
  cards: Card[];
  placements: Placement[];
  places: Place[];
  memos: Memo[];
  budgetItems: BudgetItem[];
}

export const CATEGORY_COLORS: Record<CardCategory, { bg: string; text: string; label: string }> = {
  transport:     { bg: "#f1efe8", text: "#5f5e5a", label: "교통" },
  accommodation: { bg: "#fbeaf0", text: "#993556", label: "숙소" },
  activity:      { bg: "#e1f5ee", text: "#0f6e56", label: "액티비티" },
  food:          { bg: "#faeeda", text: "#854f0b", label: "식사" },
  chill:         { bg: "#eeedfe", text: "#534ab7", label: "힐링" },
  errand:        { bg: "#e6f1fb", text: "#185fa5", label: "기타" },
};

export const DAY_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

export const COMPANION_OPTIONS: { value: CompanionType; emoji: string; label: string }[] = [
  { value: "solo", emoji: "🧳", label: "혼자" },
  { value: "couple", emoji: "💑", label: "커플" },
  { value: "friends", emoji: "👯", label: "친구" },
  { value: "family", emoji: "👨‍👩‍👧", label: "가족" },
];

export const STYLE_OPTIONS: { value: TravelStyle; emoji: string; label: string }[] = [
  { value: "food", emoji: "🍽", label: "맛집탐방" },
  { value: "activity", emoji: "🏄", label: "액티비티" },
  { value: "relax", emoji: "🧘", label: "힐링" },
  { value: "sightseeing", emoji: "📸", label: "관광" },
  { value: "shopping", emoji: "🛍", label: "쇼핑" },
  { value: "nature", emoji: "🌿", label: "자연" },
  { value: "culture", emoji: "🎭", label: "문화체험" },
];

export const STYLE_LABELS: Record<string, string> = Object.fromEntries(
  STYLE_OPTIONS.map(s => [s.value, `${s.emoji} ${s.label}`])
);

export const COMPANION_LABELS: Record<string, string> = Object.fromEntries(
  COMPANION_OPTIONS.map(c => [c.value, `${c.emoji} ${c.label}`])
);

export type Recommendation = "none" | "compatible" | "recommended" | "ideal";

export function isCompatible(card: Card, day: TripDay, slot: SlotType): boolean {
  if (!card.compatibleSlots.includes(slot)) return false;
  if (card.compatibleAreas.includes("any")) return true;
  if (day.area === "any") return true;
  return card.compatibleAreas.includes(day.area);
}

export function getRecommendation(card: Card, day: TripDay, slot: SlotType): Recommendation {
  if (!isCompatible(card, day, slot)) return "none";
  const dayRec = card.recommendedDayIndex?.includes(day.index) ?? false;
  const slotRec = card.recommendedSlot === slot;
  if (dayRec && slotRec) return "ideal";
  if (dayRec || slotRec) return "recommended";
  return "compatible";
}

export function makeSlotKey(dayId: string, slot: SlotType): string {
  return `${dayId}-${slot}`;
}

export function parseSlotKey(key: string): { dayId: string; slot: SlotType } {
  const lastDash = key.lastIndexOf("-");
  return { dayId: key.slice(0, lastDash), slot: key.slice(lastDash + 1) as SlotType };
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Date utilities
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function calcNights(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export const PLACE_CATEGORIES = ["관광", "맛집", "카페", "숙소", "쇼핑", "기타"];
export const BUDGET_CATEGORIES = ["숙소", "교통", "식비", "관광", "쇼핑", "기타"];
