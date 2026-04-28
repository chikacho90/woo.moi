import type {
  PlannerState,
  Card,
  TripDay,
  Placement,
  SlotType,
  CardCategory,
} from "./types";
import { DEFAULT_TRIP_META, SLOT_TYPES } from "./types";
import { initialState } from "./reducer";

const VALID_CATEGORIES: CardCategory[] = [
  "transport",
  "accommodation",
  "activity",
  "food",
  "chill",
  "errand",
];
const VALID_SLOTS = new Set<SlotType>(SLOT_TYPES);

function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateCard(raw: unknown): Card | null {
  if (!isObj(raw)) return null;
  const id = isStr(raw.id) ? raw.id : null;
  const name = isStr(raw.name) ? raw.name : null;
  const category = VALID_CATEGORIES.includes(raw.category as CardCategory)
    ? (raw.category as CardCategory)
    : null;
  if (!id || !name || !category) return null;

  const compatibleSlots = Array.isArray(raw.compatibleSlots)
    ? raw.compatibleSlots.filter((s): s is SlotType => VALID_SLOTS.has(s as SlotType))
    : [...SLOT_TYPES];
  const compatibleAreas = Array.isArray(raw.compatibleAreas)
    ? raw.compatibleAreas.filter(isStr)
    : ["any"];
  const tags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[]).filter(
        (t) => isObj(t) && isStr(t.label) && isStr(t.color) && isStr(t.bg)
      )
    : [];

  return {
    id,
    emoji: isStr(raw.emoji) ? raw.emoji : "📌",
    name,
    description: isStr(raw.description) ? raw.description : "",
    category,
    tags: tags as Card["tags"],
    compatibleSlots: compatibleSlots.length > 0 ? compatibleSlots : [...SLOT_TYPES],
    compatibleAreas: compatibleAreas.length > 0 ? compatibleAreas : ["any"],
    recommendedDayIndex: Array.isArray(raw.recommendedDayIndex)
      ? (raw.recommendedDayIndex as unknown[]).filter((n): n is number => typeof n === "number")
      : undefined,
    recommendedSlot: VALID_SLOTS.has(raw.recommendedSlot as SlotType)
      ? (raw.recommendedSlot as SlotType)
      : undefined,
    estimatedMinutes:
      typeof raw.estimatedMinutes === "number" ? raw.estimatedMinutes : undefined,
    estimatedCost:
      typeof raw.estimatedCost === "number" ? raw.estimatedCost : undefined,
    externalUrl: isStr(raw.externalUrl) ? raw.externalUrl : undefined,
    requiresReservation:
      typeof raw.requiresReservation === "boolean" ? raw.requiresReservation : undefined,
    reservationStatus:
      raw.reservationStatus === "none" ||
      raw.reservationStatus === "pending" ||
      raw.reservationStatus === "confirmed"
        ? raw.reservationStatus
        : undefined,
  };
}

function validateDay(raw: unknown): TripDay | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !isStr(raw.label) || !isStr(raw.area) || !isStr(raw.color)) {
    return null;
  }
  if (typeof raw.index !== "number") return null;
  return {
    id: raw.id,
    index: raw.index,
    date: isStr(raw.date) ? raw.date : null,
    label: raw.label,
    area: raw.area,
    color: raw.color,
  };
}

function validatePlacement(raw: unknown): Placement | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.cardId) || !isStr(raw.slotKey)) return null;
  if (raw.slotKey.indexOf("::") < 0) return null;
  const status = raw.status === "locked" ? "locked" : "placed";
  return {
    cardId: raw.cardId,
    slotKey: raw.slotKey,
    status,
    order: typeof raw.order === "number" ? raw.order : 0,
  };
}

export function validateState(raw: unknown): PlannerState {
  if (!isObj(raw)) return initialState;

  const tripRaw = isObj(raw.trip) ? raw.trip : {};
  const trip = {
    ...DEFAULT_TRIP_META,
    destination: isStr(tripRaw.destination) ? tripRaw.destination : "",
    startDate: isStr(tripRaw.startDate) ? tripRaw.startDate : null,
    endDate: isStr(tripRaw.endDate) ? tripRaw.endDate : null,
    budget: typeof tripRaw.budget === "number" ? tripRaw.budget : null,
    currency: isStr(tripRaw.currency) ? tripRaw.currency : "KRW",
    tags: Array.isArray(tripRaw.tags) ? (tripRaw.tags as unknown[]).filter(isStr) : [],
    areas: Array.isArray(tripRaw.areas) && (tripRaw.areas as unknown[]).every(isStr)
      ? (tripRaw.areas as string[])
      : [...DEFAULT_TRIP_META.areas],
  };

  const days = Array.isArray(raw.days)
    ? (raw.days as unknown[]).map(validateDay).filter((d): d is TripDay => d !== null)
    : [];
  const cards = Array.isArray(raw.cards)
    ? (raw.cards as unknown[]).map(validateCard).filter((c): c is Card => c !== null)
    : [];
  const cardIds = new Set(cards.map((c) => c.id));
  const dayIds = new Set(days.map((d) => d.id));
  const placements = Array.isArray(raw.placements)
    ? (raw.placements as unknown[])
        .map(validatePlacement)
        .filter((p): p is Placement => {
          if (!p) return false;
          if (!cardIds.has(p.cardId)) return false;
          const dayId = p.slotKey.slice(0, p.slotKey.indexOf("::"));
          return dayIds.has(dayId);
        })
    : [];

  const uiRaw = isObj(raw.ui) ? raw.ui : {};
  const ui: PlannerState["ui"] = {
    mode: "idle",
    activeCardId: null,
    activeSlotKey: null,
    categoryFilter: isStr(uiRaw.categoryFilter) ? uiRaw.categoryFilter : "all",
    showTripPanel: typeof uiRaw.showTripPanel === "boolean" ? uiRaw.showTripPanel : false,
  };

  return { trip, days, cards, placements, ui };
}
