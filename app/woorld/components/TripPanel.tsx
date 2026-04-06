"use client";
import { useState, useRef, useEffect } from "react";
import type { PlannerState } from "../types";
import { CURRENCY_OPTIONS } from "../types";
import type { PlannerAction } from "../reducer";

const POPULAR_DESTINATIONS = [
  "도쿄, 일본", "오사카, 일본", "교토, 일본", "후쿠오카, 일본", "삿포로, 일본",
  "오키나와, 일본", "이시가키, 일본", "나라, 일본", "가나자와, 일본", "나고야, 일본",
  "방콕, 태국", "치앙마이, 태국", "푸켓, 태국", "파타야, 태국",
  "다낭, 베트남", "호치민, 베트남", "하노이, 베트남", "나트랑, 베트남",
  "발리, 인도네시아", "싱가포르", "쿠알라룸푸르, 말레이시아", "세부, 필리핀",
  "타이베이, 대만", "홍콩", "마카오",
  "파리, 프랑스", "런던, 영국", "로마, 이탈리아", "바르셀로나, 스페인",
  "프라하, 체코", "빈, 오스트리아", "암스테르담, 네덜란드", "뮌헨, 독일",
  "뉴욕, 미국", "LA, 미국", "하와이, 미국", "샌프란시스코, 미국", "라스베이거스, 미국",
  "시드니, 호주", "멜버른, 호주", "괌", "사이판",
  "제주도", "부산", "강릉", "여수", "경주",
];

interface Props {
  state: PlannerState;
  dispatch: React.Dispatch<PlannerAction>;
  onDestinationConfirm?: (destination: string) => void;
}

export default function TripPanel({ state, dispatch, onDestinationConfirm }: Props) {
  const { trip, cards, placements } = state;
  const [tagInput, setTagInput] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [destInput, setDestInput] = useState(trip.destination);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const destRef = useRef<HTMLDivElement>(null);

  // Sync external state changes
  useEffect(() => { setDestInput(trip.destination); }, [trip.destination]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredDests = destInput.trim()
    ? POPULAR_DESTINATIONS.filter((d) =>
        d.toLowerCase().includes(destInput.toLowerCase())
      ).slice(0, 8)
    : POPULAR_DESTINATIONS.slice(0, 8);

  const selectDestination = (dest: string) => {
    setDestInput(dest);
    setShowSuggestions(false);
    dispatch({ type: "UPDATE_TRIP", updates: { destination: dest } });
    onDestinationConfirm?.(dest);
  };

  // 예산 계산
  const placedCost = placements.reduce((sum, p) => {
    const card = cards.find((c) => c.id === p.cardId);
    return sum + (card?.estimatedCost ?? 0);
  }, 0);
  const cur = CURRENCY_OPTIONS.find((c) => c.code === trip.currency) ?? CURRENCY_OPTIONS[0];
  const budgetRatio = trip.budget ? placedCost / trip.budget : 0;

  const addTag = () => {
    const t = tagInput.trim();
    if (t) {
      dispatch({ type: "ADD_TRIP_TAG", tag: t });
      setTagInput("");
    }
  };

  const addArea = () => {
    const a = areaInput.trim();
    if (a) {
      dispatch({ type: "ADD_TRIP_AREA", area: a });
      setAreaInput("");
    }
  };

  if (!state.ui.showTripPanel) return null;

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* 목적지 + 기간 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div ref={destRef} className="relative">
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            목적지
          </label>
          <input
            type="text"
            value={destInput}
            onChange={(e) => {
              setDestInput(e.target.value);
              setShowSuggestions(true);
              dispatch({ type: "UPDATE_TRIP", updates: { destination: e.target.value } });
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && destInput.trim()) {
                selectDestination(destInput.trim());
              }
            }}
            placeholder="예: 이시가키, 오사카"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          {showSuggestions && filteredDests.length > 0 && (
            <div
              className="absolute z-20 mt-1 w-full rounded-lg py-1 max-h-48 overflow-y-auto"
              style={{ background: "#1e1e2a", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
            >
              {filteredDests.map((d) => (
                <button
                  key={d}
                  onClick={() => selectDestination(d)}
                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.06]"
                  style={{ color: "#e5e5e5" }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              출발
            </label>
            <input
              type="date"
              value={trip.startDate ?? ""}
              onChange={(e) => dispatch({ type: "UPDATE_TRIP", updates: { startDate: e.target.value || null } })}
              className="w-full rounded-lg px-2 py-2 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              도착
            </label>
            <input
              type="date"
              value={trip.endDate ?? ""}
              onChange={(e) => dispatch({ type: "UPDATE_TRIP", updates: { endDate: e.target.value || null } })}
              className="w-full rounded-lg px-2 py-2 text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>
        </div>
      </div>

      {/* 예산 */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          예산
        </label>
        <div className="flex gap-2 items-center">
          <select
            value={trip.currency}
            onChange={(e) => dispatch({ type: "UPDATE_TRIP", updates: { currency: e.target.value } })}
            className="rounded-lg px-2 py-2 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.symbol} {c.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={trip.budget ?? ""}
            onChange={(e) => dispatch({ type: "UPDATE_TRIP", updates: { budget: e.target.value ? Number(e.target.value) : null } })}
            placeholder="총 예산"
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>
        {trip.budget !== null && trip.budget > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span>배치된 비용: {cur.symbol}{placedCost.toLocaleString()}</span>
              <span>{cur.symbol}{trip.budget.toLocaleString()} 중 {Math.round(budgetRatio * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(budgetRatio * 100, 100)}%`,
                  background: budgetRatio > 1 ? "#ef4444" : budgetRatio > 0.8 ? "#f59e0b" : "#10b981",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 태그 */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          태그
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {trip.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}
            >
              {t}
              <button
                onClick={() => dispatch({ type: "REMOVE_TRIP_TAG", tag: t })}
                className="opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="가족여행, 힐링, 맛집투어..."
            className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            onClick={addTag}
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
          >
            추가
          </button>
        </div>
      </div>

      {/* 위치(area) 관리 */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          위치 (카드 호환성에 사용)
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {trip.areas.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7" }}
            >
              {a}
              <button
                onClick={() => dispatch({ type: "REMOVE_TRIP_AREA", area: a })}
                className="opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addArea()}
            placeholder="새 위치 추가..."
            className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            onClick={addArea}
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
