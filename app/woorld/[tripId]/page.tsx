"use client";

import { useEffect, useState, useReducer, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getTrip, updateTrip, deleteTrip, type Trip, type Place, type Memo, type BudgetItem } from "../store/trips";
import { plannerReducer, initialState, type PlannerAction } from "../reducer";
import type { PlannerState } from "../types";
import { isCompatible, parseSlotKey, genId } from "../types";
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

/* ─── Trip Summary Header ─── */
function TripHeader({ trip, onUpdate }: { trip: Trip; onUpdate: (p: Partial<Trip>) => void }) {
  const [editing, setEditing] = useState(false);
  const [dest, setDest] = useState(trip.destination || "");

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
              onKeyDown={e => { if (e.key === "Enter") { onUpdate({ destination: dest.trim() || undefined }); setEditing(false); }}}
              className="text-xl font-bold w-full border-b border-gray-300 focus:outline-none focus:border-gray-500 bg-transparent"
              autoFocus
            />
          ) : (
            <h2
              className="text-xl font-bold cursor-pointer hover:text-gray-600 transition-colors truncate"
              onClick={() => setEditing(true)}
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
            <a href={p.url} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-600">🔗</a>
          )}
          <button
            onClick={() => onDelete(p.id)}
            className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >✕</button>
        </div>
      ))}
      {showForm ? (
        <div className="mt-4 p-4 rounded-xl bg-white border border-gray-100 space-y-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="장소 이름"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" autoFocus />
          <div className="flex flex-wrap gap-1.5">
            {PLACE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-3 py-1 rounded-full text-xs transition-all"
                style={{ background: category === c ? "#1a1a1a" : "#f5f5f5", color: category === c ? "#fff" : "#666" }}>
                {c}
              </button>
            ))}
          </div>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800">추가</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all">
          + 장소 추가
        </button>
      )}
    </div>
  );
}

/* ─── Memo Tab ─── */
function MemoTab({ memos, onUpdate }: {
  memos: Memo[];
  onUpdate: (memos: Memo[]) => void;
}) {
  // Simple single memo for now
  const memo = memos[0] || { id: genId(), content: "", updatedAt: Date.now() };
  const [content, setContent] = useState(memo.content);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate([{ ...memo, content: val, updatedAt: Date.now() }]);
    }, 500);
  };

  return (
    <div className="px-5 py-4">
      <textarea
        value={content}
        onChange={e => handleChange(e.target.value)}
        placeholder="여행 메모를 자유롭게 적어보세요... ✏️"
        className="w-full min-h-[300px] px-4 py-3 rounded-xl border border-gray-200 text-sm leading-relaxed resize-y focus:outline-none focus:border-gray-400 bg-white"
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
        <p className="text-xs text-gray-400 mb-1">총 예산</p>
        <p className="text-3xl font-bold">{total.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {Object.entries(byCategory).map(([cat, amt]) => (
            <span key={cat} className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
              {cat} {amt.toLocaleString()}원
            </span>
          ))}
        </div>
      )}

      {/* Items */}
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-3 py-3 border-b border-gray-50 group">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{i.category}</span>
          <span className="flex-1 text-sm">{i.label}</span>
          <span className="text-sm font-medium">{i.amount.toLocaleString()}원</span>
          <button onClick={() => onDelete(i.id)}
            className="text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">✕</button>
        </div>
      ))}

      {showForm ? (
        <div className="mt-4 p-4 rounded-xl bg-white border border-gray-100 space-y-3">
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="항목명"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" autoFocus />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="금액 (원)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          <div className="flex flex-wrap gap-1.5">
            {BUDGET_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-3 py-1 rounded-full text-xs transition-all"
                style={{ background: category === c ? "#1a1a1a" : "#f5f5f5", color: category === c ? "#fff" : "#666" }}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800">추가</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all">
          + 지출 추가
        </button>
      )}
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
  const [activeTab, setActiveTab] = useState<TabType>("schedule");

  // Planner state (schedule tab)
  const [plannerState, plannerDispatch] = useReducer(plannerReducer, initialState);
  const [showAddDay, setShowAddDay] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trip
  useEffect(() => {
    const t = getTrip(tripId);
    if (!t) {
      router.push("/woorld");
      return;
    }
    setTrip(t);
    // Load planner state from trip
    plannerDispatch({
      type: "LOAD",
      payload: { days: t.days, cards: t.cards, placements: t.placements, ui: initialState.ui },
    });
    setLoaded(true);
  }, [tripId]);

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
  }, [plannerState.days, plannerState.cards, plannerState.placements, loaded]);

  // Handlers
  const handleTripUpdate = (partial: Partial<Trip>) => {
    const updated = updateTrip(tripId, partial);
    if (updated) setTrip(updated);
  };

  const handleAddPlace = (place: Place) => {
    if (!trip) return;
    handleTripUpdate({ places: [...trip.places, place] });
  };

  const handleDeletePlace = (id: string) => {
    if (!trip) return;
    handleTripUpdate({ places: trip.places.filter(p => p.id !== id) });
  };

  const handleUpdateMemos = (memos: Memo[]) => {
    handleTripUpdate({ memos });
  };

  const handleAddBudget = (item: BudgetItem) => {
    if (!trip) return;
    handleTripUpdate({ budgetItems: [...trip.budgetItems, item] });
  };

  const handleDeleteBudget = (id: string) => {
    if (!trip) return;
    handleTripUpdate({ budgetItems: trip.budgetItems.filter(i => i.id !== id) });
  };

  const handleDeleteTrip = () => {
    if (confirm("이 여행을 삭제할까요?")) {
      deleteTrip(tripId);
      router.push("/woorld");
    }
  };

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
        <p className="text-sm text-gray-300 animate-pulse">loading...</p>
      </div>
    );
  }

  const isSelecting = plannerState.ui.mode === "card-selecting" || plannerState.ui.mode === "slot-selecting";

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Top nav */}
      <div className="sticky top-0 z-30 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/woorld")} className="text-xs text-gray-400 hover:text-gray-600">← 목록</button>
          <div className="flex items-center gap-2">
            {activeTab === "schedule" && (
              <>
                <button onClick={() => setShowAddDay(true)} className="px-3 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200">+ 날짜</button>
                <button onClick={() => setShowAddCard(true)} className="px-3 py-1 rounded-lg text-xs bg-gray-900 text-white hover:bg-gray-800">+ 카드</button>
              </>
            )}
            <button onClick={handleDeleteTrip} className="px-2 py-1 text-xs text-gray-300 hover:text-red-400" title="여행 삭제">🗑</button>
          </div>
        </div>
      </div>

      {/* Trip header */}
      <div className="max-w-2xl mx-auto">
        <TripHeader trip={trip} onUpdate={handleTripUpdate} />
      </div>

      {/* Tabs */}
      <div className="sticky top-[49px] z-20 bg-[#fafaf8]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-3 text-center text-xs font-medium transition-all relative"
              style={{ color: activeTab === tab.key ? "#1a1a1a" : "#999" }}
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
        <div className="sticky top-[97px] z-10 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-medium text-blue-700">
            {plannerState.ui.mode === "card-selecting" ? "호환되는 슬롯을 탭하세요" : "호환되는 카드를 탭하세요"}
          </p>
          <button onClick={() => plannerDispatch({ type: "SET_UI_MODE", payload: { mode: "idle" } })}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 bg-white border border-blue-200">취소</button>
        </div>
      )}

      {/* Tab content */}
      <div className="max-w-2xl mx-auto pb-32">
        {activeTab === "schedule" && (
          <>
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
    </div>
  );
}
