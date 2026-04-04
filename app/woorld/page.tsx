"use client";
import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import { plannerReducer, initialState } from "./reducer";
import type { PlannerState } from "./types";
import ScheduleGrid from "./components/ScheduleGrid";
import CardPool from "./components/CardPool";
import AddDayModal from "./components/AddDayModal";
import AddCardModal from "./components/AddCardModal";

const STORAGE_KEY = "woorld-planner-state";

function loadState(): PlannerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlannerState;
  } catch {
    return null;
  }
}

export default function WoorldPage() {
  const [state, dispatch] = useReducer(plannerReducer, initialState, (init) => {
    const saved = loadState();
    return saved ?? init;
  });

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);

  // Auto-save to localStorage (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const handleReset = useCallback(() => {
    if (confirm("모든 데이터를 초기화하시겠습니까?")) {
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: "RESET" });
    }
  }, []);

  const handleCancel = () => {
    dispatch({
      type: "SET_UI",
      ui: { mode: "idle", activeCardId: null, activeSlotKey: null },
    });
  };

  const modeBanner = (() => {
    if (state.ui.mode === "card-selecting") {
      const card = state.cards.find((c) => c.id === state.ui.activeCardId);
      return card
        ? `${card.emoji} ${card.name} — 배치할 슬롯을 선택하세요`
        : null;
    }
    if (state.ui.mode === "slot-selecting") {
      return "슬롯 선택됨 — 아래 후보 풀에서 카드를 선택하세요";
    }
    return null;
  })();

  const poolCount = state.cards.filter(
    (c) => !state.placements.some((p) => p.cardId === c.id)
  ).length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0a0a12", color: "#e5e5e5" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 py-3 backdrop-blur-md"
        style={{ background: "rgba(10,10,18,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <h1 className="text-sm font-bold tracking-tight" style={{ color: "#fff" }}>
            woorld
          </h1>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDayModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "rgba(255,255,255,0.08)", color: "#ccc" }}
            >
              + 날짜
            </button>
            <button
              onClick={() => setCardModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "#fff", color: "#0a0a12" }}
            >
              + 카드
            </button>
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* Mode banner */}
      {modeBanner && (
        <div
          className="sticky top-[49px] z-30 px-4 py-2 flex items-center justify-between"
          style={{ background: "rgba(24,95,165,0.15)", borderBottom: "1px solid rgba(24,95,165,0.2)" }}
        >
          <span className="text-xs font-medium" style={{ color: "#7eb8f0" }}>
            {modeBanner}
          </span>
          <button
            onClick={handleCancel}
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "rgba(24,95,165,0.2)", color: "#7eb8f0" }}
          >
            취소
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">
        {/* Schedule Grid */}
        <ScheduleGrid state={state} dispatch={dispatch} />

        {/* Card Pool */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2
              className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              후보 카드 풀
            </h2>
            {poolCount > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
              >
                {poolCount}
              </span>
            )}
          </div>
          <CardPool state={state} dispatch={dispatch} />
        </div>
      </div>

      {/* Modals */}
      <AddDayModal
        open={dayModalOpen}
        onClose={() => setDayModalOpen(false)}
        onAdd={(day) => dispatch({ type: "ADD_DAY", day })}
        nextIndex={state.days.length}
      />
      <AddCardModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        onAdd={(card) => dispatch({ type: "ADD_CARD", card })}
        days={state.days}
      />
    </div>
  );
}
