"use client";

import { useEffect, useState, useReducer, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getTrip, updateTrip, deleteTrip } from "../store/trips";
import { plannerReducer, initialState } from "../reducer";
import type { Trip, Card, TravelStyle } from "../types";
import {
  genId, SLOT_TYPES, isCompatible, parseSlotKey, makeSlotKey,
  STYLE_OPTIONS, STYLE_LABELS, COMPANION_OPTIONS, COMPANION_LABELS,
  calcNights, addDays, DAY_COLORS,
} from "../types";
import { findDestination } from "../data/destinations";
import PlannerGrid from "../components/PlannerGrid";
import CardPool from "../components/CardPool";
import AddCardModal from "../components/AddCardModal";
import Calendar from "../components/Calendar";

/* ─── Confirm Dialog ─── */
function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: "fadeIn 150ms" }} />
      <div onClick={e => e.stopPropagation()} className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-6" style={{ animation: "modalIn 200ms" }}>
        <p className="text-sm text-gray-700 text-center mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">삭제</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Panel ─── */
function SettingsPanel({ trip, onUpdate, onClose, onAiSuggest, aiLoading }: {
  trip: Trip;
  onUpdate: (p: Partial<Trip>) => void;
  onClose: () => void;
  onAiSuggest: () => void;
  aiLoading: boolean;
}) {
  const [editDest, setEditDest] = useState(false);
  const [dest, setDest] = useState(trip.destination || "");
  const [showCal, setShowCal] = useState(false);

  const nightsLabel = trip.nights ? `${trip.nights}박 ${trip.nights + 1}일` : null;

  const toggleStyle = (s: TravelStyle) => {
    const next = trip.styles.includes(s)
      ? trip.styles.filter(x => x !== s)
      : [...trip.styles, s];
    onUpdate({ styles: next });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">여행 설정</h3>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-sm">✕</button>
      </div>

      {/* Destination */}
      {editDest ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">여행지</p>
          <input
            value={dest}
            onChange={e => setDest(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                onUpdate({ destination: dest.trim() || undefined });
                setEditDest(false);
              }
            }}
            placeholder="오사카, 발리, 유럽..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
            autoFocus
          />
          <button
            onClick={() => { onUpdate({ destination: dest.trim() || undefined }); setEditDest(false); }}
            className="px-3 py-1 rounded-lg text-[11px] font-medium bg-gray-900 text-white"
          >확인</button>
        </div>
      ) : (
        <button onClick={() => { setDest(trip.destination || ""); setEditDest(true); }}
          className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">여행지</p>
          <p className={`text-sm font-medium mt-0.5 ${trip.destination ? "text-gray-900" : "text-gray-300"}`}>
            {trip.destination || "어디로?"}
          </p>
        </button>
      )}

      {/* Dates */}
      <div>
        <button onClick={() => setShowCal(!showCal)}
          className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">기간</p>
          <p className={`text-sm font-medium mt-0.5 ${trip.startDate ? "text-gray-900" : "text-gray-300"}`}>
            {trip.startDate
              ? `${trip.startDate}${trip.endDate ? ` ~ ${trip.endDate}` : ""} ${nightsLabel ? `(${nightsLabel})` : ""}`
              : "언제?"}
          </p>
        </button>
        {showCal && (
          <div className="mt-2 p-3 bg-white rounded-xl border border-gray-100" style={{ animation: "modalIn 200ms" }}>
            <Calendar
              startDate={trip.startDate || null}
              endDate={trip.endDate || null}
              onSelect={(start, end) => {
                onUpdate({
                  startDate: start,
                  endDate: end,
                  nights: end ? calcNights(start, end) : null,
                });
              }}
            />
            <button onClick={() => setShowCal(false)} className="mt-2 w-full py-1.5 rounded-lg text-xs text-gray-400 bg-gray-50 hover:bg-gray-100">닫기</button>
          </div>
        )}
      </div>

      {/* Companion */}
      <div>
        <p className="text-[10px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">누구랑</p>
        <div className="flex gap-1.5 flex-wrap">
          {COMPANION_OPTIONS.map(c => (
            <button key={c.value} onClick={() => onUpdate({ companions: c.value })}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                trip.companions === c.value ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >{c.emoji} {c.label}</button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div>
        <p className="text-[10px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">예산 (만원)</p>
        <input
          type="number"
          value={trip.budget || ""}
          onChange={e => onUpdate({ budget: e.target.value ? parseInt(e.target.value) : null })}
          placeholder="예: 200"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>

      {/* Styles */}
      <div>
        <p className="text-[10px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">스타일</p>
        <div className="flex gap-1.5 flex-wrap">
          {STYLE_OPTIONS.map(s => (
            <button key={s.value} onClick={() => toggleStyle(s.value)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                trip.styles.includes(s.value) ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >{s.emoji} {s.label}</button>
          ))}
        </div>
      </div>

      {/* AI button */}
      <button
        onClick={onAiSuggest}
        disabled={aiLoading}
        className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all ${
          aiLoading
            ? "bg-gray-100 text-gray-400 cursor-wait"
            : "bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-lg shadow-violet-200 active:scale-[0.98]"
        }`}
      >
        {aiLoading ? "⏳ AI가 생각하는 중..." : "✨ AI에게 퍼즐 추천받기"}
      </button>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function TripDashboard() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [plannerState, plannerDispatch] = useReducer(plannerReducer, initialState);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trip
  useEffect(() => {
    const t = getTrip(tripId);
    if (!t) { router.push("/woorld"); return; }
    setTrip(t);
    plannerDispatch({
      type: "LOAD",
      payload: { days: t.days, cards: t.cards, placements: t.placements, ui: initialState.ui },
    });
    setLoaded(true);
  }, [tripId, router]);

  // Auto-save
  useEffect(() => {
    if (!loaded || !trip) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const updated = updateTrip(tripId, {
        days: plannerState.days,
        cards: plannerState.cards,
        placements: plannerState.placements,
      });
      if (updated) setTrip(updated);
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [plannerState.days, plannerState.cards, plannerState.placements, loaded, tripId, trip]);

  // Trip settings update
  const handleTripUpdate = useCallback((partial: Partial<Trip>) => {
    const updated = updateTrip(tripId, partial);
    if (updated) {
      setTrip(updated);
      // Sync days when dates change
      if (partial.startDate !== undefined || partial.endDate !== undefined) {
        const start = partial.startDate ?? updated.startDate;
        const end = partial.endDate ?? updated.endDate;
        if (start && end) {
          const nights = calcNights(start, end);
          const totalDays = nights + 1;
          const newDays = [];
          for (let i = 0; i < totalDays; i++) {
            const existing = updated.days[i];
            newDays.push({
              id: existing?.id || genId(),
              index: i,
              date: addDays(start, i),
              label: existing?.label || `Day ${i + 1}`,
              area: existing?.area || "any",
              color: existing?.color || DAY_COLORS[i % DAY_COLORS.length],
            });
          }
          plannerDispatch({ type: "LOAD", payload: { ...plannerState, days: newDays, ui: plannerState.ui } });
          updateTrip(tripId, { days: newDays, nights });
        }
      }
    }
  }, [tripId, plannerState]);

  // AI suggest - uses destination DB + API
  const handleAiSuggest = useCallback(async () => {
    if (!trip) return;
    setAiLoading(true);

    // First: try destination DB for instant cards
    const dest = trip.destinationId ? findDestination(trip.destinationId) : null;
    if (dest) {
      const styles = trip.styles;
      let spots = styles.length > 0
        ? dest.spots.filter(s => styles.includes(s.style as TravelStyle))
        : dest.spots;
      if (spots.length < 5) {
        const remaining = dest.spots.filter(s => !spots.includes(s));
        spots = [...spots, ...remaining.slice(0, 5 - spots.length)];
      }
      const existingNames = new Set(plannerState.cards.map(c => c.name));
      for (const spot of spots.slice(0, 10)) {
        if (existingNames.has(spot.name)) continue;
        plannerDispatch({
          type: "ADD_CARD",
          payload: {
            emoji: spot.emoji, name: spot.name, description: spot.description,
            category: spot.category, tags: [], compatibleSlots: spot.slots,
            compatibleAreas: ["any"], estimatedMinutes: spot.estimatedMinutes,
          },
        });
      }
    }

    // Second: try AI API for richer recommendations
    try {
      const res = await fetch("/api/woorld/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: trip.destination,
          days: trip.nights ? trip.nights + 1 : plannerState.days.length || 3,
          companion: trip.companions,
          budget: trip.budget,
          styles: trip.styles,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const existingNames = new Set(plannerState.cards.map(c => c.name));
        for (const c of (data.cards || [])) {
          if (existingNames.has(c.name)) continue;
          plannerDispatch({ type: "ADD_CARD", payload: { ...c, id: genId(), tags: c.tags || [] } });
          existingNames.add(c.name);
        }
      }
    } catch {}

    // Auto-create days if empty
    if (plannerState.days.length === 0) {
      const dayCount = trip.nights ? trip.nights + 1 : 3;
      for (let i = 0; i < dayCount; i++) {
        plannerDispatch({ type: "ADD_DAY", payload: {
          label: `Day ${i + 1}`,
          date: trip.startDate ? addDays(trip.startDate, i) : null,
          color: DAY_COLORS[i % DAY_COLORS.length],
        }});
      }
    }

    setAiLoading(false);
  }, [trip, plannerState]);

  // Card interactions
  const handlePoolCardTap = useCallback((cardId: string) => {
    if (plannerState.ui.mode === "slot-selecting" && plannerState.ui.activeSlotKey) {
      const { dayId, slot } = parseSlotKey(plannerState.ui.activeSlotKey);
      const card = plannerState.cards.find(c => c.id === cardId);
      const day = plannerState.days.find(d => d.id === dayId);
      if (card && day && isCompatible(card, day, slot)) {
        plannerDispatch({ type: "PLACE_CARD", payload: { cardId, slotKey: plannerState.ui.activeSlotKey } });
      } else {
        plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
      }
    } else if (plannerState.ui.mode === "card-selecting" && plannerState.ui.activeCardId === cardId) {
      plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
    } else {
      plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "card-selecting", activeCardId: cardId } });
    }
  }, [plannerState]);

  const handlePoolDragStart = useCallback((cardId: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
    setDragCardId(cardId);
    plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "dragging", activeCardId: cardId } });
  }, []);

  // Drag cleanup
  useEffect(() => {
    const handler = () => {
      setDragCardId(null);
      setDragOverSlot(null);
      if (plannerState.ui.mode === "dragging") {
        plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } });
      }
    };
    window.addEventListener("dragend", handler);
    return () => window.removeEventListener("dragend", handler);
  }, [plannerState.ui.mode]);

  if (!loaded || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf8" }}>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const isSelecting = plannerState.ui.mode === "card-selecting" || plannerState.ui.mode === "slot-selecting";
  const unplacedCount = plannerState.cards.filter(c => !plannerState.placements.find(p => p.cardId === c.id)).length;
  const totalSlots = plannerState.days.length * 5;
  const filledSlots = new Set(plannerState.placements.map(p => p.slotKey)).size;
  const progress = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const destData = trip.destinationId ? findDestination(trip.destinationId) : null;
  const emoji = destData?.emoji || (trip.destination ? "✈️" : "🧩");

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/woorld")} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">&larr;</button>
            <span className="text-lg">{emoji}</span>
            <h1 className="text-base font-bold truncate">{trip.destination || "새 여행"}</h1>
            {trip.nights != null && (
              <span className="text-xs text-gray-400 hidden sm:inline">{trip.nights}박 {trip.nights + 1}일</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Progress */}
            {totalSlots > 0 && (
              <div className="flex items-center gap-2 mr-1">
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      background: progress === 100 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                    }} />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${progress === 100 ? "text-emerald-500" : "text-gray-400"}`}>
                  {progress === 100 ? "🎉" : `${progress}%`}
                </span>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showSettings ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              ⚙ 설정
            </button>
            <button onClick={() => setShowAddCard(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              + 카드
            </button>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="px-2 py-1.5 text-xs text-gray-300 hover:text-red-400 transition-colors" aria-label="여행 삭제">🗑</button>
          </div>
        </div>
      </div>

      {/* Selection banner */}
      {isSelecting && (
        <div className="sticky top-[45px] z-20 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-medium text-blue-700">
            🧩 {plannerState.ui.mode === "card-selecting" ? "퍼즐을 놓을 슬롯을 선택하세요" : "넣을 퍼즐 조각을 선택하세요"}
          </p>
          <button onClick={() => plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } })}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200">취소</button>
        </div>
      )}

      {/* Main layout */}
      <div className="max-w-6xl mx-auto flex">
        {/* Settings sidebar */}
        {showSettings && (
          <div className="w-72 shrink-0 border-r border-gray-200 bg-white p-4 min-h-[calc(100vh-45px)]" style={{ animation: "fadeIn 150ms" }}>
            <SettingsPanel
              trip={trip}
              onUpdate={handleTripUpdate}
              onClose={() => setShowSettings(false)}
              onAiSuggest={handleAiSuggest}
              aiLoading={aiLoading}
            />
          </div>
        )}

        {/* Puzzle area: board + pieces only */}
        <div className="flex-1 min-w-0 p-4">
          {plannerState.days.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">🧩</span>
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-2">퍼즐판을 만들어볼까요?</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
                설정에서 여행 기간을 정하거나,<br/>AI에게 추천을 받아보세요.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => setShowSettings(true)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                  ⚙ 설정 열기
                </button>
                <button onClick={handleAiSuggest} disabled={aiLoading}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-lg shadow-violet-200 transition-all disabled:opacity-50 active:scale-[0.98]">
                  {aiLoading ? "⏳ 생각 중..." : "✨ AI로 시작하기"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Puzzle board */}
              <PlannerGrid
                state={plannerState}
                dispatch={plannerDispatch}
                dragCardId={dragCardId}
                dragOverSlot={dragOverSlot}
                setDragCardId={setDragCardId}
                setDragOverSlot={setDragOverSlot}
                onEditDay={() => {}}
              />

              {/* Puzzle pieces */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-700">🧩 퍼즐 조각</h3>
                    {unplacedCount > 0 && (
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{unplacedCount}개 남음</span>
                    )}
                  </div>
                  {unplacedCount === 0 && plannerState.cards.length > 0 && (
                    <span className="text-xs font-bold text-emerald-500 animate-pop">✅ 모든 조각 배치 완료!</span>
                  )}
                </div>
                <CardPool
                  cards={plannerState.cards}
                  placements={plannerState.placements}
                  categoryFilter={plannerState.ui.categoryFilter}
                  activeCardId={plannerState.ui.activeCardId}
                  mode={plannerState.ui.mode}
                  onCategoryChange={f => plannerDispatch({ type: "SET_CATEGORY_FILTER", payload: { filter: f } })}
                  onCardTap={handlePoolCardTap}
                  onCardDragStart={handlePoolDragStart}
                />

                {/* AI suggest inline (when cards exist but want more) */}
                {plannerState.cards.length > 0 && (
                  <button onClick={handleAiSuggest} disabled={aiLoading}
                    className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-xs text-indigo-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all disabled:opacity-50">
                    {aiLoading ? "⏳ 생각 중..." : "✨ AI에게 퍼즐 조각 더 받기"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddCard && (
        <AddCardModal
          days={plannerState.days}
          onAdd={card => plannerDispatch({ type: "ADD_CARD", payload: card })}
          onClose={() => setShowAddCard(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          message="이 여행을 삭제할까요? 모든 데이터가 사라집니다."
          onConfirm={() => { deleteTrip(tripId); router.push("/woorld"); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
