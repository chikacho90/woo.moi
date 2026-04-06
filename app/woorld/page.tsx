"use client";
import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import { plannerReducer, initialState } from "./reducer";
import type { PlannerState } from "./types";
import { CURRENCY_OPTIONS } from "./types";
import ScheduleGrid from "./components/ScheduleGrid";
import CardPool from "./components/CardPool";
import TripPanel from "./components/TripPanel";
import AddDayModal from "./components/AddDayModal";
import AddCardModal from "./components/AddCardModal";

const STORAGE_KEY = "woorld-planner-state";

function loadState(): PlannerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw) as any;
    // migrate: add trip if missing
    if (!parsed.trip) {
      parsed.trip = { ...initialState.trip };
    }
    if (parsed.ui && !("showTripPanel" in parsed.ui)) {
      parsed.ui.showTripPanel = false;
    }
    return parsed;
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

  // 예산 요약
  const { trip, placements, cards } = state;
  const placedCost = placements.reduce((sum, p) => {
    const card = cards.find((c) => c.id === p.cardId);
    return sum + (card?.estimatedCost ?? 0);
  }, 0);
  const cur = CURRENCY_OPTIONS.find((c) => c.code === trip.currency) ?? CURRENCY_OPTIONS[0];
  const hasBudget = trip.budget !== null && trip.budget > 0;

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
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold tracking-tight flex-shrink-0" style={{ color: "#fff" }}>
                woorld
              </h1>
              {trip.destination && (
                <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                  / {trip.destination}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => dispatch({ type: "SET_UI", ui: { showTripPanel: !state.ui.showTripPanel } })}
                className="px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  background: state.ui.showTripPanel ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.08)",
                  color: state.ui.showTripPanel ? "#a5b4fc" : "#ccc",
                }}
              >
                설정
              </button>
              <button
                onClick={handleReset}
                className="px-2 py-1.5 rounded-lg text-xs transition-colors hidden sm:block"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                초기화
              </button>
            </div>
          </div>

          {/* 간략 요약 바 — 목적지/기간/예산이 있을 때 표시 */}
          {(trip.destination || hasBudget || trip.tags.length > 0) && !state.ui.showTripPanel && (
            <div className="flex items-center gap-3 mt-2 overflow-x-auto pb-0.5">
              {trip.startDate && trip.endDate && (
                <span className="text-[10px] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {trip.startDate} → {trip.endDate}
                </span>
              )}
              {hasBudget && (
                <span className="text-[10px] whitespace-nowrap" style={{ color: placedCost > trip.budget! ? "#ef4444" : "rgba(255,255,255,0.3)" }}>
                  {cur.symbol}{placedCost.toLocaleString()} / {cur.symbol}{trip.budget!.toLocaleString()}
                </span>
              )}
              {trip.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(99,102,241,0.1)", color: "rgba(165,180,252,0.7)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
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

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Trip Panel (collapsible) */}
        <TripPanel state={state} dispatch={dispatch} />

        {/* Schedule Grid */}
        <ScheduleGrid state={state} dispatch={dispatch} onAddDay={() => setDayModalOpen(true)} />

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
          <CardPool state={state} dispatch={dispatch} onAddCard={() => setCardModalOpen(true)} />
        </div>
      </div>

      {/* Modals */}
      <AddDayModal
        open={dayModalOpen}
        onClose={() => setDayModalOpen(false)}
        onAdd={(day) => dispatch({ type: "ADD_DAY", day })}
        nextIndex={state.days.length}
        areas={state.trip.areas}
      />
      <AddCardModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        onAdd={(card) => dispatch({ type: "ADD_CARD", card })}
        days={state.days}
        areas={state.trip.areas}
      />
    </div>
  );
}
