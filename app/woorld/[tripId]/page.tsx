"use client";

import { useEffect, useState, useReducer, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getTrip, updateTrip, deleteTrip, type Trip, type Place, type Memo, type BudgetItem } from "../store/trips";
import { plannerReducer, initialState, type PlannerAction } from "../reducer";
import type { PlannerState, Card, CardCategory, SlotType } from "../types";
import { isCompatible, parseSlotKey, genId, SLOT_TYPES, CATEGORY_COLORS } from "../types";
import PlannerGrid from "../components/PlannerGrid";
import CardPool from "../components/CardPool";
import AddDayModal from "../components/AddDayModal";
import AddCardModal from "../components/AddCardModal";

type TabType = "schedule" | "places" | "memo" | "budget";

const TABS: { key: TabType; emoji: string; label: string }[] = [
  { key: "schedule", emoji: "📋", label: "일정표" },
  { key: "places", emoji: "🗺", label: "장소" },
  { key: "memo", emoji: "📝", label: "메모" },
  { key: "budget", emoji: "💰", label: "예산" },
];

const STYLE_LABELS: Record<string, string> = {
  food: "🍽 맛집", activity: "🏄 액티비티", relax: "🧘 힐링",
  sightseeing: "📸 관광", shopping: "🛍 쇼핑", nature: "🌿 자연", culture: "🎭 문화체험",
};

const COMPANION_LABELS: Record<string, string> = {
  solo: "🧳 혼자", couple: "💑 커플", friends: "👯 친구", family: "👨‍👩‍👧 가족",
};

const PLACE_CATEGORIES = ["관광", "맛집", "카페", "숙소", "쇼핑", "기타"];
const BUDGET_CATEGORIES = ["숙소", "교통", "식비", "관광", "쇼핑", "기타"];

/* ─── Confirm Dialog ─── */
function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 animate-modalIn"
      >
        <p className="text-sm text-gray-700 text-center mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Trip Summary Header ─── */
function TripHeader({ trip, onUpdate }: { trip: Trip; onUpdate: (p: Partial<Trip>) => void }) {
  const [editing, setEditing] = useState(false);
  const [dest, setDest] = useState(trip.destination || "");

  useEffect(() => {
    setDest(trip.destination || "");
  }, [trip.destination]);

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl mt-0.5">{trip.destination ? "✈️" : "🗺"}</span>
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
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-400">
            {trip.startDate && <span>{trip.startDate}{trip.endDate ? ` ~ ${trip.endDate}` : ""}</span>}
            {trip.nights && <span>{trip.nights}박</span>}
            <span>{COMPANION_LABELS[trip.companions]}</span>
            {trip.budget && <span>💰 {trip.budget.min}~{trip.budget.max}만</span>}
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

/* ─── Places Tab ─── */
function PlacesTab({ places, onAdd, onDelete }: {
  places: Place[];
  onAdd: (p: Place) => void;
  onDelete: (id: string) => void;
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
    <div className="px-5 py-4">
      {places.length === 0 && !showForm && (
        <div className="text-center py-12">
          <span className="text-3xl block mb-3">📍</span>
          <p className="text-sm text-gray-400 mb-4">가고 싶은 곳을 모아보세요</p>
        </div>
      )}
      {places.map(p => (
        <div key={p.id} className="flex items-center gap-3 py-3 border-b border-gray-50 group">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.category}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{p.name}</p>
            {p.note && <p className="text-xs text-gray-400 truncate">{p.note}</p>}
          </div>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-600" aria-label={`${p.name} 링크 열기`}>🔗</a>
          )}
          <button
            onClick={() => setDeleteId(p.id)}
            className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            aria-label={`${p.name} 삭제`}
          >✕</button>
        </div>
      ))}
      {showForm ? (
        <div className="mt-4 p-4 rounded-xl bg-white border border-gray-100 space-y-3 animate-modalIn">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="장소 이름"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" autoFocus
            onKeyDown={e => e.key === "Enter" && handleAdd()} aria-label="장소 이름" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="장소 카테고리">
            {PLACE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-3 py-1 rounded-full text-xs transition-all"
                style={{ background: category === c ? "#1a1a1a" : "#f5f5f5", color: category === c ? "#fff" : "#666" }}
                aria-pressed={category === c}>
                {c}
              </button>
            ))}
          </div>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" aria-label="장소 메모" />
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" aria-label="장소 URL" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!name.trim()} className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 transition-all">추가</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all">
          + 장소 추가
        </button>
      )}
      {deleteId && (
        <ConfirmDialog
          message="이 장소를 삭제할까요?"
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ─── Memo Tab ─── */
function MemoTab({ memos, onUpdate }: {
  memos: Memo[];
  onUpdate: (memos: Memo[]) => void;
}) {
  const memoId = useRef(memos[0]?.id || genId());
  const [content, setContent] = useState(memos[0]?.content || "");
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
    <div className="px-5 py-4">
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        placeholder="여행 메모를 자유롭게 적어보세요..."
        className="w-full min-h-[300px] px-4 py-3 rounded-xl border border-gray-200 text-sm leading-relaxed resize-y focus:outline-none focus:border-gray-400 bg-white"
        aria-label="여행 메모"
      />
      <p className="text-[10px] text-gray-300 mt-2 text-right">자동 저장됨</p>
    </div>
  );
}

/* ─── Budget Tab ─── */
function BudgetTab({ items, currency, onAdd, onDelete }: {
  items: BudgetItem[];
  currency: string;
  onAdd: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("식비");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const byCategory = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + i.amount;
    return acc;
  }, {});

  const handleAdd = () => {
    if (!label.trim() || !amount) return;
    onAdd({ id: genId(), label: label.trim(), amount: parseInt(amount), currency, category, note: "" });
    setLabel(""); setAmount(""); setShowForm(false);
  };

  return (
    <div className="px-5 py-4">
      {/* Total */}
      <div className="text-center py-4 mb-4">
        <p className="text-xs text-gray-400 mb-1">총 지출</p>
        <p className="text-3xl font-bold">{total.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <span key={cat} className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
              {cat} {amt.toLocaleString()}원
            </span>
          ))}
        </div>
      )}

      {/* Items */}
      {items.length === 0 && !showForm && (
        <div className="text-center py-8">
          <span className="text-3xl block mb-3">💳</span>
          <p className="text-sm text-gray-400">지출 내역을 추가해보세요</p>
        </div>
      )}
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-3 py-3 border-b border-gray-50 group">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{i.category}</span>
          <span className="flex-1 text-sm">{i.label}</span>
          <span className="text-sm font-medium">{i.amount.toLocaleString()}원</span>
          <button onClick={() => setDeleteId(i.id)}
            className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            aria-label={`${i.label} 삭제`}>✕</button>
        </div>
      ))}

      {showForm ? (
        <div className="mt-4 p-4 rounded-xl bg-white border border-gray-100 space-y-3 animate-modalIn">
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="항목명"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" autoFocus
            onKeyDown={e => e.key === "Enter" && handleAdd()} aria-label="지출 항목명" />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="금액 (원)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
            onKeyDown={e => e.key === "Enter" && handleAdd()} aria-label="금액" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="지출 카테고리">
            {BUDGET_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-3 py-1 rounded-full text-xs transition-all"
                style={{ background: category === c ? "#1a1a1a" : "#f5f5f5", color: category === c ? "#fff" : "#666" }}
                aria-pressed={category === c}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!label.trim() || !amount} className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 transition-all">추가</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all">
          + 지출 추가
        </button>
      )}

      {deleteId && (
        <ConfirmDialog
          message="이 지출을 삭제할까요?"
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ─── AI Sample Cards Generator (stub) ─── */
function generateSampleCards(styles: string[]): Omit<Card, "id">[] {
  const samples: Record<string, Omit<Card, "id">[]> = {
    food: [
      { emoji: "🍜", name: "현지 맛집 탐방", description: "로컬 추천 맛집", category: "food" as CardCategory, tags: [], compatibleSlots: ["점심", "저녁"] as SlotType[], compatibleAreas: ["any"] },
      { emoji: "☕", name: "카페 투어", description: "분위기 좋은 카페", category: "food" as CardCategory, tags: [], compatibleSlots: ["오후"] as SlotType[], compatibleAreas: ["any"] },
    ],
    activity: [
      { emoji: "🏊", name: "수상 액티비티", description: "스노클링 / 카약", category: "activity" as CardCategory, tags: [], compatibleSlots: ["오전", "오후"] as SlotType[], compatibleAreas: ["any"] },
    ],
    relax: [
      { emoji: "🧖", name: "스파 & 마사지", description: "피로 회복", category: "chill" as CardCategory, tags: [], compatibleSlots: ["오후", "저녁"] as SlotType[], compatibleAreas: ["any"] },
    ],
    sightseeing: [
      { emoji: "🏛", name: "주요 관광지", description: "꼭 가볼 명소", category: "activity" as CardCategory, tags: [], compatibleSlots: ["오전", "오후"] as SlotType[], compatibleAreas: ["any"] },
      { emoji: "📸", name: "포토 스팟", description: "인생샷 장소", category: "activity" as CardCategory, tags: [], compatibleSlots: ["오전", "오후"] as SlotType[], compatibleAreas: ["any"] },
    ],
    shopping: [
      { emoji: "🛍", name: "쇼핑", description: "현지 쇼핑 스팟", category: "errand" as CardCategory, tags: [], compatibleSlots: ["오후", "저녁"] as SlotType[], compatibleAreas: ["any"] },
    ],
    nature: [
      { emoji: "🌿", name: "자연 탐방", description: "트레킹 / 공원", category: "activity" as CardCategory, tags: [], compatibleSlots: ["오전", "오후"] as SlotType[], compatibleAreas: ["any"] },
    ],
    culture: [
      { emoji: "🎭", name: "문화 체험", description: "현지 문화 경험", category: "activity" as CardCategory, tags: [], compatibleSlots: ["오전", "오후", "저녁"] as SlotType[], compatibleAreas: ["any"] },
    ],
  };

  const result: Omit<Card, "id">[] = [];
  const used = new Set<string>();

  // Add cards based on styles
  for (const style of styles) {
    const cards = samples[style];
    if (cards) {
      for (const card of cards) {
        if (!used.has(card.name) && result.length < 5) {
          used.add(card.name);
          result.push(card);
        }
      }
    }
  }

  // If no styles or too few cards, add defaults
  if (result.length === 0) {
    result.push(
      { emoji: "🏛", name: "주요 관광지", description: "꼭 가볼 명소", category: "activity" as CardCategory, tags: [], compatibleSlots: ["오전", "오후"] as SlotType[], compatibleAreas: ["any"] },
      { emoji: "🍜", name: "현지 맛집", description: "로컬 추천 맛집", category: "food" as CardCategory, tags: [], compatibleSlots: ["점심", "저녁"] as SlotType[], compatibleAreas: ["any"] },
      { emoji: "☕", name: "카페", description: "분위기 좋은 카페", category: "food" as CardCategory, tags: [], compatibleSlots: ["오후"] as SlotType[], compatibleAreas: ["any"] },
    );
  }

  return result;
}

/* ─── Main Dashboard ─── */
export default function TripDashboard() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("schedule");

  // Planner state (schedule tab)
  const [plannerState, plannerDispatch] = useReducer(plannerReducer, initialState);
  const [showAddDay, setShowAddDay] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trip
  useEffect(() => {
    const t = getTrip(tripId);
    if (!t) {
      router.push("/woorld");
      return;
    }
    setTrip(t);
    plannerDispatch({
      type: "LOAD",
      payload: { days: t.days, cards: t.cards, placements: t.placements, ui: initialState.ui },
    });
    setLoaded(true);
  }, [tripId, router]);

  // Auto-save planner to trip
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
    if (updated) setTrip(updated);
  }, [tripId]);

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
    handleTripUpdate({ memos });
  }, [handleTripUpdate]);

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

  // AI fill stub
  const handleAiFill = useCallback(() => {
    if (!trip) return;
    const cards = generateSampleCards(trip.styles);
    for (const card of cards) {
      plannerDispatch({ type: "ADD_CARD", payload: card });
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

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Top nav */}
      <div className="sticky top-0 z-30 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/woorld")} className="text-xs text-gray-400 hover:text-gray-600 transition-colors py-1" aria-label="여행 목록으로 돌아가기">← 목록</button>
          <div className="flex items-center gap-2">
            {activeTab === "schedule" && (
              <>
                <button onClick={() => setShowAddDay(true)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">+ 날짜</button>
                <button onClick={() => setShowAddCard(true)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-900 text-white hover:bg-gray-800 transition-colors">+ 카드</button>
              </>
            )}
            <button onClick={() => setShowDeleteConfirm(true)} className="px-2 py-1.5 text-xs text-gray-300 hover:text-red-400 transition-colors" title="여행 삭제" aria-label="여행 삭제">🗑</button>
          </div>
        </div>
      </div>

      {/* Trip header */}
      <div className="max-w-2xl mx-auto">
        <TripHeader trip={trip} onUpdate={handleTripUpdate} />
      </div>

      {/* Tabs */}
      <div className="sticky top-[49px] z-20 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 flex" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-3 text-center text-xs font-medium transition-all relative"
              style={{ color: activeTab === tab.key ? "#1a1a1a" : "#999" }}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
            >
              {tab.emoji} {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gray-900 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selection banner (schedule) */}
      {activeTab === "schedule" && isSelecting && (
        <div className="sticky top-[97px] z-10 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between animate-fadeIn">
          <p className="text-xs font-medium text-blue-700">
            {plannerState.ui.mode === "card-selecting" ? "호환되는 슬롯을 탭하세요" : "호환되는 카드를 탭하세요"}
          </p>
          <button onClick={() => plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } })}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 transition-colors">취소</button>
        </div>
      )}

      {/* Tab content */}
      <div className="max-w-2xl mx-auto pb-32" role="tabpanel" id={`tabpanel-${activeTab}`}>
        {activeTab === "schedule" && (
          <>
            {/* AI fill button */}
            {plannerState.cards.length === 0 && (
              <div className="px-4 pt-4">
                <button
                  onClick={handleAiFill}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-200 text-sm text-indigo-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all"
                >
                  ✨ AI가 채워줄까?
                </button>
              </div>
            )}

            <div className="px-4 py-4">
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
          </>
        )}

        {activeTab === "places" && (
          <PlacesTab places={trip.places} onAdd={handleAddPlace} onDelete={handleDeletePlace} />
        )}

        {activeTab === "memo" && (
          <MemoTab memos={trip.memos} onUpdate={handleUpdateMemos} />
        )}

        {activeTab === "budget" && (
          <BudgetTab items={trip.budgetItems} currency="KRW" onAdd={handleAddBudget} onDelete={handleDeleteBudget} />
        )}
      </div>

      {/* Modals */}
      {showAddDay && (
        <AddDayModal
          dayCount={plannerState.days.length}
          onAdd={day => plannerDispatch({ type: "ADD_DAY", payload: day })}
          onClose={() => setShowAddDay(false)}
        />
      )}
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
