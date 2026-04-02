"use client";

import { useEffect, useState, useReducer, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getTrip, updateTrip, deleteTrip } from "../store/trips";
import { plannerReducer, initialState } from "../reducer";
import type { Trip, Card, CardCategory, SlotType, Place, Memo, BudgetItem, TravelStyle } from "../types";
import {
  genId, SLOT_TYPES, CATEGORY_COLORS, isCompatible, parseSlotKey, makeSlotKey,
  STYLE_LABELS, COMPANION_LABELS, PLACE_CATEGORIES, BUDGET_CATEGORIES, calcNights, addDays, DAY_COLORS,
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

/* ─── Section Header ─── */
function SectionHeader({ emoji, title, action }: { emoji: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
        <span>{emoji}</span> {title}
      </h3>
      {action}
    </div>
  );
}

/* ─── Trip Header ─── */
function TripHeader({ trip, onUpdate }: { trip: Trip; onUpdate: (p: Partial<Trip>) => void }) {
  const [editing, setEditing] = useState(false);
  const [dest, setDest] = useState(trip.destination || "");
  const destData = trip.destinationId ? findDestination(trip.destinationId) : null;
  const emoji = destData?.emoji || (trip.destination ? "✈️" : "🗺");

  useEffect(() => { setDest(trip.destination || ""); }, [trip.destination]);

  const nightsLabel = trip.nights ? `${trip.nights}박 ${trip.nights + 1}일` : null;

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={dest}
              onChange={e => setDest(e.target.value)}
              onBlur={() => { onUpdate({ destination: dest.trim() || undefined }); setEditing(false); }}
              onKeyDown={e => { if (e.key === "Enter") { onUpdate({ destination: dest.trim() || undefined }); setEditing(false); } }}
              className="text-xl font-bold w-full border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent"
              autoFocus
              aria-label="여행 목적지 수정"
            />
          ) : (
            <h2
              className="text-xl font-bold cursor-pointer hover:text-gray-600 transition-colors truncate"
              onClick={() => setEditing(true)}
              title="클릭하여 수정"
            >
              {trip.destination || "어딘가로..."}
            </h2>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
            {trip.startDate && <span>{trip.startDate}{trip.endDate ? ` ~ ${trip.endDate}` : ""}</span>}
            {nightsLabel && <span>{nightsLabel}</span>}
            <span>{COMPANION_LABELS[trip.companions]}</span>
            {trip.budget && <span>💰 {trip.budget}만원</span>}
          </div>
          {trip.styles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {trip.styles.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                  {STYLE_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Places Section ─── */
function PlacesSection({ places, onAdd, onDelete }: {
  places: Place[]; onAdd: (p: Place) => void; onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("관광");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ id: genId(), name: name.trim(), category, note: note.trim() || undefined, url: url.trim() || undefined, addedAt: Date.now() });
    setName(""); setNote(""); setUrl(""); setShowForm(false);
  };

  return (
    <div>
      {places.length === 0 && !showForm && (
        <p className="text-sm text-gray-300 text-center py-4">가고 싶은 곳을 추가해보세요</p>
      )}
      {places.map(p => (
        <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 group">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.category}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{p.name}</p>
            {p.note && <p className="text-xs text-gray-400 truncate">{p.note}</p>}
          </div>
          {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-600">🔗</a>}
          <button onClick={() => setDeleteId(p.id)} className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" aria-label="삭제">✕</button>
        </div>
      ))}
      {showForm ? (
        <div className="mt-3 p-4 rounded-xl bg-white border border-gray-100 space-y-3" style={{ animation: "modalIn 200ms" }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="장소 이름" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" autoFocus onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <div className="flex flex-wrap gap-1.5">
            {PLACE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} className="px-3 py-1 rounded-full text-xs transition-all" style={{ background: category === c ? "#1a1a1a" : "#f5f5f5", color: category === c ? "#fff" : "#666" }}>{c}</button>
            ))}
          </div>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (선택)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (선택)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!name.trim()} className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 transition-all">추가</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all">+ 장소 추가</button>
      )}
      {deleteId && (
        <ConfirmDialog message="이 장소를 삭제할까요?" onConfirm={() => { onDelete(deleteId); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

/* ─── Memo Section ─── */
function MemoSection({ memos, onUpdate }: { memos: Memo[]; onUpdate: (m: Memo[]) => void }) {
  const memoId = useRef(memos[0]?.id || genId());
  const [content, setContent] = useState(memos[0]?.content || "");
  const [expanded, setExpanded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate([{ id: memoId.current, content: val, updatedAt: Date.now() }]);
    }, 500);
  };

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  return (
    <div>
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setExpanded(true)}
        onBlur={() => !content && setExpanded(false)}
        placeholder="여행 메모를 자유롭게 적어보세요..."
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm leading-relaxed resize-none focus:outline-none focus:border-gray-400 bg-white transition-all"
        style={{ minHeight: expanded ? 150 : 60 }}
        aria-label="여행 메모"
      />
      <p className="text-[10px] text-gray-300 mt-1 text-right">자동 저장</p>
    </div>
  );
}

/* ─── Budget Section ─── */
function BudgetSection({ items, totalBudget, onAdd, onDelete }: {
  items: BudgetItem[]; totalBudget?: number | null; onAdd: (i: BudgetItem) => void; onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("식비");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const spent = items.reduce((sum, i) => sum + i.amount, 0);
  const byCategory = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + i.amount;
    return acc;
  }, {});

  const handleAdd = () => {
    if (!label.trim() || !amount) return;
    onAdd({ id: genId(), label: label.trim(), amount: parseInt(amount), currency: "KRW", category });
    setLabel(""); setAmount(""); setShowForm(false);
  };

  return (
    <div>
      {/* Summary */}
      <div className="text-center py-3 mb-3">
        <p className="text-xs text-gray-400 mb-1">지출</p>
        <p className="text-2xl font-bold">
          {spent.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">원</span>
        </p>
        {totalBudget && (
          <div className="mt-2">
            <div className="w-full max-w-xs mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (spent / (totalBudget * 10000)) * 100)}%`,
                  background: spent > totalBudget * 10000 ? "#ef4444" : "#10b981",
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">예산 {totalBudget}만원 중 {Math.round(spent / 10000)}만원 사용</p>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <span key={cat} className="px-2.5 py-1 rounded-full text-[11px] bg-gray-100 text-gray-600">{cat} {amt.toLocaleString()}원</span>
          ))}
        </div>
      )}

      {/* Items */}
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 group">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{i.category}</span>
          <span className="flex-1 text-sm">{i.label}</span>
          <span className="text-sm font-medium">{i.amount.toLocaleString()}원</span>
          <button onClick={() => setDeleteId(i.id)} className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" aria-label="삭제">✕</button>
        </div>
      ))}

      {showForm ? (
        <div className="mt-3 p-4 rounded-xl bg-white border border-gray-100 space-y-3" style={{ animation: "modalIn 200ms" }}>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="항목명" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" autoFocus onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="금액 (원)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <div className="flex flex-wrap gap-1.5">
            {BUDGET_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} className="px-3 py-1 rounded-full text-xs transition-all" style={{ background: category === c ? "#1a1a1a" : "#f5f5f5", color: category === c ? "#fff" : "#666" }}>{c}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!label.trim() || !amount} className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 transition-all">추가</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all">+ 지출 추가</button>
      )}

      {deleteId && (
        <ConfirmDialog message="이 지출을 삭제할까요?" onConfirm={() => { onDelete(deleteId); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

/* ─── Date Change Inline ─── */
function DateChangeSection({ trip, onUpdate }: { trip: Trip; onUpdate: (p: Partial<Trip>) => void }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (start: string, end: string | null) => {
    onUpdate({
      startDate: start,
      endDate: end,
      nights: end ? calcNights(start, end) : null,
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-indigo-500 hover:text-indigo-600 transition-colors">
        📅 날짜 변경
      </button>
    );
  }

  return (
    <div className="mt-3 p-4 bg-white rounded-xl border border-gray-100" style={{ animation: "modalIn 200ms" }}>
      <Calendar startDate={trip.startDate || null} endDate={trip.endDate || null} onSelect={handleSelect} />
      <button onClick={() => setOpen(false)} className="mt-3 w-full py-2 rounded-lg text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">닫기</button>
    </div>
  );
}

/* ─── Main ─── */
export default function TripDashboard() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Planner state
  const [plannerState, plannerDispatch] = useReducer(plannerReducer, initialState);
  const [showAddCard, setShowAddCard] = useState(false);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  // Auto-save planner
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

  // Handlers
  const handleTripUpdate = useCallback((partial: Partial<Trip>) => {
    const updated = updateTrip(tripId, partial);
    if (updated) {
      setTrip(updated);
      // If dates changed, regenerate days
      if (partial.startDate !== undefined || partial.endDate !== undefined) {
        const start = partial.startDate ?? updated.startDate;
        const end = partial.endDate ?? updated.endDate;
        if (start && end) {
          const nights = calcNights(start, end);
          const totalDays = nights + 1;
          const newDays = [];
          for (let i = 0; i < totalDays; i++) {
            const existingDay = updated.days[i];
            newDays.push({
              id: existingDay?.id || genId(),
              index: i,
              date: addDays(start, i),
              label: existingDay?.label || `Day ${i + 1}`,
              area: existingDay?.area || "any",
              color: existingDay?.color || DAY_COLORS[i % DAY_COLORS.length],
            });
          }
          plannerDispatch({ type: "LOAD", payload: { ...plannerState, days: newDays, ui: plannerState.ui } });
          updateTrip(tripId, { days: newDays, nights });
        }
      }
    }
  }, [tripId, plannerState]);

  const handleAddPlace = useCallback((place: Place) => {
    setTrip(prev => {
      if (!prev) return prev;
      const updated = updateTrip(tripId, { places: [...prev.places, place] });
      return updated || prev;
    });
  }, [tripId]);

  const handleDeletePlace = useCallback((id: string) => {
    setTrip(prev => {
      if (!prev) return prev;
      const updated = updateTrip(tripId, { places: prev.places.filter(p => p.id !== id) });
      return updated || prev;
    });
  }, [tripId]);

  const handleUpdateMemos = useCallback((memos: Memo[]) => {
    updateTrip(tripId, { memos });
  }, [tripId]);

  const handleAddBudget = useCallback((item: BudgetItem) => {
    setTrip(prev => {
      if (!prev) return prev;
      const updated = updateTrip(tripId, { budgetItems: [...prev.budgetItems, item] });
      return updated || prev;
    });
  }, [tripId]);

  const handleDeleteBudget = useCallback((id: string) => {
    setTrip(prev => {
      if (!prev) return prev;
      const updated = updateTrip(tripId, { budgetItems: prev.budgetItems.filter(i => i.id !== id) });
      return updated || prev;
    });
  }, [tripId]);

  const handleDeleteTrip = useCallback(() => {
    deleteTrip(tripId);
    router.push("/woorld");
  }, [tripId, router]);

  // AI card generation
  const handleAiFill = useCallback(() => {
    if (!trip) return;
    const dest = trip.destinationId ? findDestination(trip.destinationId) : null;
    if (!dest) return;

    const styles = trip.styles;
    let spots = styles.length > 0
      ? dest.spots.filter(s => styles.includes(s.style as TravelStyle))
      : dest.spots;

    if (spots.length < 5) {
      const remaining = dest.spots.filter(s => !spots.includes(s));
      spots = [...spots, ...remaining.slice(0, 5 - spots.length)];
    }

    for (const spot of spots.slice(0, 8)) {
      plannerDispatch({
        type: "ADD_CARD",
        payload: {
          emoji: spot.emoji,
          name: spot.name,
          description: spot.description,
          category: spot.category,
          tags: [],
          compatibleSlots: spot.slots,
          compatibleAreas: ["any"],
          estimatedMinutes: spot.estimatedMinutes,
        },
      });
    }
  }, [trip]);

  // Pool card tap
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
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-300">불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isSelecting = plannerState.ui.mode === "card-selecting" || plannerState.ui.mode === "slot-selecting";
  const unplacedCards = plannerState.cards.filter(c => !plannerState.placements.find(p => p.cardId === c.id));

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Top nav */}
      <div className="sticky top-0 z-30 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/woorld")} className="text-xs text-gray-400 hover:text-gray-600 transition-colors py-1" aria-label="여행 목록으로 돌아가기">&larr; 목록</button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddCard(true)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-900 text-white hover:bg-gray-800 transition-colors">+ 카드</button>
            <button onClick={() => setShowDeleteConfirm(true)} className="px-2 py-1.5 text-xs text-gray-300 hover:text-red-400 transition-colors" aria-label="여행 삭제">🗑</button>
          </div>
        </div>
      </div>

      {/* Trip header */}
      <div className="max-w-2xl mx-auto">
        <TripHeader trip={trip} onUpdate={handleTripUpdate} />
      </div>

      {/* Selection banner */}
      {isSelecting && (
        <div className="sticky top-[49px] z-10 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between" style={{ animation: "fadeIn 150ms" }}>
          <p className="text-xs font-medium text-blue-700">
            {plannerState.ui.mode === "card-selecting" ? "호환되는 슬롯을 탭하세요" : "호환되는 카드를 탭하세요"}
          </p>
          <button onClick={() => plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } })}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 transition-colors">취소</button>
        </div>
      )}

      {/* ALL SECTIONS on one page */}
      <div className="max-w-2xl mx-auto pb-32">

        {/* ─── Section: Schedule ─── */}
        <div className="px-4 pt-4">
          <SectionHeader
            emoji="📋"
            title="일정"
            action={
              <DateChangeSection trip={trip} onUpdate={handleTripUpdate} />
            }
          />

          {/* AI fill button */}
          {plannerState.cards.length === 0 && trip.destinationId && (
            <button
              onClick={handleAiFill}
              className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-200 text-sm text-indigo-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all mb-4"
            >
              ✨ 추천 카드 생성
            </button>
          )}

          <PlannerGrid
            state={plannerState}
            dispatch={plannerDispatch}
            dragCardId={dragCardId}
            dragOverSlot={dragOverSlot}
            setDragCardId={setDragCardId}
            setDragOverSlot={setDragOverSlot}
            onEditDay={() => {}}
          />
        </div>

        {/* ─── Section: Recommended Cards ─── */}
        <div className="px-4 pt-6">
          <SectionHeader
            emoji="🃏"
            title={`추천 카드${unplacedCards.length > 0 ? ` (${unplacedCards.length})` : ""}`}
            action={
              <button onClick={() => setShowAddCard(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">+ 직접 추가</button>
            }
          />
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
        </div>

        {/* ─── Section: Places ─── */}
        <div className="px-4 pt-6">
          <SectionHeader emoji="📍" title="가고 싶은 곳" />
          <PlacesSection places={trip.places} onAdd={handleAddPlace} onDelete={handleDeletePlace} />
        </div>

        {/* ─── Section: Memo ─── */}
        <div className="px-4 pt-6">
          <SectionHeader emoji="📝" title="메모" />
          <MemoSection memos={trip.memos} onUpdate={handleUpdateMemos} />
        </div>

        {/* ─── Section: Budget ─── */}
        <div className="px-4 pt-6 pb-8">
          <SectionHeader emoji="💰" title="예산" />
          <BudgetSection items={trip.budgetItems} totalBudget={trip.budget} onAdd={handleAddBudget} onDelete={handleDeleteBudget} />
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
          onConfirm={handleDeleteTrip}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
