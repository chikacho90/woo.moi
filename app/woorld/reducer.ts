import type {
  PlannerState,
  TripDay,
  TripMeta,
  Card,
  Placement,
  SlotType,
  Recommendation,
} from "./types";
import { makeSlotKey, DEFAULT_TRIP_META } from "./types";

// ── 액션 타입 ──
export type PlannerAction =
  | { type: "UPDATE_TRIP"; updates: Partial<TripMeta> }
  | { type: "ADD_TRIP_AREA"; area: string }
  | { type: "REMOVE_TRIP_AREA"; area: string }
  | { type: "ADD_TRIP_TAG"; tag: string }
  | { type: "REMOVE_TRIP_TAG"; tag: string }
  | { type: "ADD_DAY"; day: TripDay }
  | { type: "UPDATE_DAY"; dayId: string; updates: Partial<TripDay> }
  | { type: "REMOVE_DAY"; dayId: string }
  | { type: "ADD_CARD"; card: Card }
  | { type: "UPDATE_CARD"; cardId: string; updates: Partial<Card> }
  | { type: "REMOVE_CARD"; cardId: string }
  | { type: "PLACE_CARD"; cardId: string; slotKey: string }
  | { type: "MOVE_CARD"; cardId: string; slotKey: string }
  | { type: "UNPLACE_CARD"; cardId: string }
  | { type: "LOCK_CARD"; cardId: string }
  | { type: "UNLOCK_CARD"; cardId: string }
  | { type: "SET_UI"; ui: Partial<PlannerState["ui"]> }
  | { type: "RESET" }
  | { type: "LOAD"; state: PlannerState };

export const initialState: PlannerState = {
  trip: { ...DEFAULT_TRIP_META },
  days: [],
  cards: [],
  placements: [],
  ui: {
    mode: "idle",
    activeCardId: null,
    activeSlotKey: null,
    categoryFilter: "all",
    showTripPanel: false,
  },
};

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction
): PlannerState {
  switch (action.type) {
    case "UPDATE_TRIP":
      return { ...state, trip: { ...state.trip, ...action.updates } };

    case "ADD_TRIP_AREA":
      return {
        ...state,
        trip: {
          ...state.trip,
          areas: state.trip.areas.includes(action.area)
            ? state.trip.areas
            : [...state.trip.areas, action.area],
        },
      };

    case "REMOVE_TRIP_AREA":
      return {
        ...state,
        trip: { ...state.trip, areas: state.trip.areas.filter((a) => a !== action.area) },
      };

    case "ADD_TRIP_TAG":
      return {
        ...state,
        trip: {
          ...state.trip,
          tags: state.trip.tags.includes(action.tag)
            ? state.trip.tags
            : [...state.trip.tags, action.tag],
        },
      };

    case "REMOVE_TRIP_TAG":
      return {
        ...state,
        trip: { ...state.trip, tags: state.trip.tags.filter((t) => t !== action.tag) },
      };

    case "ADD_DAY":
      return { ...state, days: [...state.days, action.day] };

    case "UPDATE_DAY":
      return {
        ...state,
        days: state.days.map((d) =>
          d.id === action.dayId ? { ...d, ...action.updates } : d
        ),
      };

    case "REMOVE_DAY": {
      const slotsToRemove = new Set(
        state.days
          .filter((d) => d.id === action.dayId)
          .flatMap((d) =>
            (["오전", "점심", "오후", "저녁", "밤"] as SlotType[]).map(
              (s) => makeSlotKey(d.id, s)
            )
          )
      );
      return {
        ...state,
        days: state.days
          .filter((d) => d.id !== action.dayId)
          .map((d, i) => ({ ...d, index: i })),
        placements: state.placements.filter(
          (p) => !slotsToRemove.has(p.slotKey)
        ),
      };
    }

    case "ADD_CARD":
      return { ...state, cards: [...state.cards, action.card] };

    case "UPDATE_CARD":
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.cardId ? { ...c, ...action.updates } : c
        ),
      };

    case "REMOVE_CARD":
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.cardId),
        placements: state.placements.filter(
          (p) => p.cardId !== action.cardId
        ),
      };

    case "PLACE_CARD": {
      const existing = state.placements.filter(
        (p) => p.slotKey === action.slotKey
      );
      const newPlacement: Placement = {
        cardId: action.cardId,
        slotKey: action.slotKey,
        status: "placed",
        order: existing.length,
      };
      return {
        ...state,
        placements: [
          ...state.placements.filter((p) => p.cardId !== action.cardId),
          newPlacement,
        ],
        ui: { ...state.ui, mode: "idle", activeCardId: null, activeSlotKey: null },
      };
    }

    case "MOVE_CARD": {
      const existing = state.placements.filter(
        (p) => p.slotKey === action.slotKey && p.cardId !== action.cardId
      );
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.cardId === action.cardId
            ? { ...p, slotKey: action.slotKey, status: "placed", order: existing.length }
            : p
        ),
        ui: { ...state.ui, mode: "idle", activeCardId: null, activeSlotKey: null },
      };
    }

    case "UNPLACE_CARD":
      return {
        ...state,
        placements: state.placements.filter(
          (p) => p.cardId !== action.cardId
        ),
      };

    case "LOCK_CARD":
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.cardId === action.cardId ? { ...p, status: "locked" } : p
        ),
      };

    case "UNLOCK_CARD":
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.cardId === action.cardId ? { ...p, status: "placed" } : p
        ),
      };

    case "SET_UI":
      return { ...state, ui: { ...state.ui, ...action.ui } };

    case "RESET":
      return initialState;

    case "LOAD":
      return action.state;

    default:
      return state;
  }
}

// ── 호환성 함수 ──
export function isCompatible(
  card: Card,
  day: TripDay,
  slot: SlotType
): boolean {
  if (!card.compatibleSlots.includes(slot)) return false;
  if (card.compatibleAreas.includes("any")) return true;
  if (day.area === "any") return true;
  return card.compatibleAreas.includes(day.area);
}

export function getRecommendation(
  card: Card,
  day: TripDay,
  slot: SlotType
): Recommendation {
  if (!isCompatible(card, day, slot)) return "none";
  const dayRec = card.recommendedDayIndex?.includes(day.index) ?? false;
  const slotRec = card.recommendedSlot === slot;
  if (dayRec && slotRec) return "ideal";
  if (dayRec || slotRec) return "recommended";
  return "compatible";
}
