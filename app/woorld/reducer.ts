/* ─── Puzzle Schedule Planner — Reducer ─── */

import type { PlannerState, Card, TripDay, Placement, SlotType, CardCategory } from "./types";
import { genId, DAY_COLORS } from "./types";

export type PlannerAction =
  | { type: "ADD_DAY"; payload?: Partial<TripDay> }
  | { type: "UPDATE_DAY"; payload: { id: string } & Partial<TripDay> }
  | { type: "REMOVE_DAY"; payload: { id: string } }
  | { type: "ADD_CARD"; payload: Omit<Card, "id"> & { id?: string } }
  | { type: "UPDATE_CARD"; payload: { id: string } & Partial<Card> }
  | { type: "REMOVE_CARD"; payload: { id: string } }
  | { type: "PLACE_CARD"; payload: { cardId: string; slotKey: string } }
  | { type: "MOVE_CARD"; payload: { cardId: string; slotKey: string } }
  | { type: "UNPLACE_CARD"; payload: { cardId: string } }
  | { type: "LOCK_CARD"; payload: { cardId: string } }
  | { type: "UNLOCK_CARD"; payload: { cardId: string } }
  | { type: "SET_UI_MODE"; payload: { mode: PlannerState["ui"]["mode"]; activeCardId?: string | null; activeSlotKey?: string | null } }
  | { type: "SET_CATEGORY_FILTER"; payload: { filter: string } }
  | { type: "RESET" }
  | { type: "LOAD"; payload: PlannerState };

export const initialState: PlannerState = {
  days: [],
  cards: [],
  placements: [],
  ui: { mode: "idle", activeCardId: null, activeSlotKey: null, categoryFilter: "all" },
};

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case "ADD_DAY": {
      const index = state.days.length;
      const day: TripDay = {
        id: genId(),
        index,
        date: null,
        label: `Day ${index + 1}`,
        area: "any",
        color: DAY_COLORS[index % DAY_COLORS.length],
        ...action.payload,
      };
      return { ...state, days: [...state.days, day] };
    }

    case "UPDATE_DAY": {
      const { id, ...rest } = action.payload;
      return {
        ...state,
        days: state.days.map(d => d.id === id ? { ...d, ...rest } : d),
      };
    }

    case "REMOVE_DAY": {
      const dayId = action.payload.id;
      return {
        ...state,
        days: state.days.filter(d => d.id !== dayId).map((d, i) => ({ ...d, index: i })),
        placements: state.placements.filter(p => !p.slotKey.startsWith(dayId)),
      };
    }

    case "ADD_CARD": {
      const card: Card = { ...action.payload, id: action.payload.id || genId() };
      return { ...state, cards: [...state.cards, card] };
    }

    case "UPDATE_CARD": {
      const { id, ...rest } = action.payload;
      return {
        ...state,
        cards: state.cards.map(c => c.id === id ? { ...c, ...rest } : c),
      };
    }

    case "REMOVE_CARD": {
      return {
        ...state,
        cards: state.cards.filter(c => c.id !== action.payload.id),
        placements: state.placements.filter(p => p.cardId !== action.payload.id),
      };
    }

    case "PLACE_CARD": {
      const { cardId, slotKey } = action.payload;
      const existing = state.placements.filter(p => p.slotKey === slotKey);
      const placement: Placement = {
        cardId,
        slotKey,
        status: "placed",
        order: existing.length,
      };
      // Remove from old position if any
      const filtered = state.placements.filter(p => p.cardId !== cardId);
      return {
        ...state,
        placements: [...filtered, placement],
        ui: { ...state.ui, mode: "idle", activeCardId: null, activeSlotKey: null },
      };
    }

    case "MOVE_CARD": {
      const { cardId, slotKey } = action.payload;
      const existing = state.placements.filter(p => p.slotKey === slotKey && p.cardId !== cardId);
      return {
        ...state,
        placements: [
          ...state.placements.filter(p => p.cardId !== cardId),
          { cardId, slotKey, status: "placed", order: existing.length },
        ],
      };
    }

    case "UNPLACE_CARD": {
      return {
        ...state,
        placements: state.placements.filter(p => p.cardId !== action.payload.cardId),
      };
    }

    case "LOCK_CARD": {
      return {
        ...state,
        placements: state.placements.map(p =>
          p.cardId === action.payload.cardId ? { ...p, status: "locked" as const } : p
        ),
      };
    }

    case "UNLOCK_CARD": {
      return {
        ...state,
        placements: state.placements.map(p =>
          p.cardId === action.payload.cardId ? { ...p, status: "placed" as const } : p
        ),
      };
    }

    case "SET_UI_MODE": {
      return {
        ...state,
        ui: {
          ...state.ui,
          mode: action.payload.mode,
          activeCardId: action.payload.activeCardId ?? null,
          activeSlotKey: action.payload.activeSlotKey ?? null,
        },
      };
    }

    case "SET_CATEGORY_FILTER": {
      return {
        ...state,
        ui: { ...state.ui, categoryFilter: action.payload.filter },
      };
    }

    case "RESET":
      return initialState;

    case "LOAD":
      return { ...action.payload, ui: action.payload.ui || initialState.ui };

    default:
      return state;
  }
}
