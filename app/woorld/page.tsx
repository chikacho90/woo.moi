"use client";

import { useReducer, useState, useEffect, useCallback, useRef } from "react";
import { plannerReducer, initialState } from "./reducer";
import type { PlannerAction } from "./reducer";
import type { PlannerState, SlotType } from "./types";
import { isCompatible, makeSlotKey, parseSlotKey } from "./types";
import PlannerGrid from "./components/PlannerGrid";
import CardPool from "./components/CardPool";
import AddDayModal from "./components/AddDayModal";
import AddCardModal from "./components/AddCardModal";

const STORAGE_KEY = "woorld-planner-state";

function loadState(): PlannerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function WoorldPage() {
  const [state, dispatch] = useReducer(plannerReducer, initialState);
  const [loaded, setLoaded] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editDayId, setEditDayId] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = loadState();
    if (saved) dispatch({ type: "LOAD", payload: saved });
    setLoaded(true);
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { ui, ...rest } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, ui: initialState.ui }));
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, loaded]);

  // Drag end cleanup
  useEffect(() => {
    const handler = () => {
      setDragCardId(null);
      setDragOverSlot(null);
      if (state.ui.mode === "dragging") {
        dispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
      }
    };
    window.addEventListener("dragend", handler);
    return () => window.removeEventListener("dragend", handler);
  }, [state.ui.mode]);

  // Card tap in pool (card-first selection)
  const handlePoolCardTap = useCallback((cardId: string) => {
    if (state.ui.mode === "slot-selecting" && state.ui.activeSlotKey) {
      // Slot was selected first, now place card
      const { dayId, slot } = parseSlotKey(state.ui.activeSlotKey);
      const card = state.cards.find(c => c.id === cardId);
      const day = state.days.find(d => d.id === dayId);
      if (card && day && isCompatible(card, day, slot)) {
        dispatch({ type: "PLACE_CARD", payload: { cardId, slotKey: state.ui.activeSlotKey } });
      } else {
        dispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
      }
    } else if (state.ui.mode === "card-selecting" && state.ui.activeCardId === cardId) {
      // Same card tapped again → cancel
      dispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
    } else {
      // Card-first: select card, wait for slot
      dispatch({ type: "SET_UI_MODE", payload: { mode: "card-selecting", activeCardId: cardId } });
    }
  }, [state]);

  const handlePoolDragStart = useCallback((cardId: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
    setDragCardId(cardId);
    dispatch({ type: "SET_UI_MODE", payload: { mode: "dragging", activeCardId: cardId } });
  }, []);

  const handleReset = () => {
    if (confirm("전체 일정을 초기화할까요?")) {
      dispatch({ type: "RESET" });
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const cancelSelection = () => {
    dispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-300 animate-pulse">loading...</p>
      </div>
    );
  }

  const isSelecting = state.ui.mode === "card-selecting" || state.ui.mode === "slot-selecting";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">&larr;</a>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">woorld</h1>
            <span className="text-xs text-gray-300 font-mono">schedule planner</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddDay(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              + 날짜
            </button>
            <button
              onClick={() => setShowAddCard(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              + 카드
            </button>
            <button
              onClick={handleReset}
              className="px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:text-red-400 transition-colors"
              title="초기화"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* Selection banner */}
      {isSelecting && (
        <div className="sticky top-[53px] z-20 bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs font-medium text-blue-700">
            {state.ui.mode === "card-selecting"
              ? "호환되는 슬롯을 탭하세요"
              : "호환되는 카드를 탭하세요"}
          </p>
          <button
            onClick={cancelSelection}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            취소
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <PlannerGrid
          state={state}
          dispatch={dispatch}
          dragCardId={dragCardId}
          dragOverSlot={dragOverSlot}
          setDragCardId={setDragCardId}
          setDragOverSlot={setDragOverSlot}
          onEditDay={setEditDayId}
        />
      </div>

      {/* Card Pool */}
      <CardPool
        cards={state.cards}
        placements={state.placements}
        categoryFilter={state.ui.categoryFilter}
        activeCardId={state.ui.activeCardId}
        mode={state.ui.mode}
        onCategoryChange={filter => dispatch({ type: "SET_CATEGORY_FILTER", payload: { filter } })}
        onCardTap={handlePoolCardTap}
        onCardDragStart={handlePoolDragStart}
      />

      {/* Modals */}
      {showAddDay && (
        <AddDayModal
          dayCount={state.days.length}
          onAdd={day => dispatch({ type: "ADD_DAY", payload: day })}
          onClose={() => setShowAddDay(false)}
        />
      )}
      {showAddCard && (
        <AddCardModal
          days={state.days}
          onAdd={card => dispatch({ type: "ADD_CARD", payload: card })}
          onClose={() => setShowAddCard(false)}
        />
      )}
    </div>
  );
}
