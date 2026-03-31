/* ─── Puzzle Schedule Planner — Types ─── */

export type CardStatus = "pool" | "placed" | "locked";
export type CardCategory = "transport" | "accommodation" | "activity" | "food" | "chill" | "errand";
export type SlotType = "오전" | "점심" | "오후" | "저녁" | "밤";

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
