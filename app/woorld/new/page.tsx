"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createTrip } from "../store/trips";
import type { CompanionType, TravelStyle } from "../types";
import { COMPANION_OPTIONS, STYLE_OPTIONS, calcNights } from "../types";
import {
  DESTINATIONS,
  searchDestinations,
  getTrendingDestinations,
  getDestinationsByStyle,
  findDestination,
  type Destination,
} from "../data/destinations";
import Calendar from "../components/Calendar";

const STEPS = ["destination", "dates", "companions", "budget", "styles"] as const;
type Step = (typeof STEPS)[number];

export default function NewTripPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);

  // Form state
  const [destination, setDestination] = useState("");
  const [destinationId, setDestinationId] = useState<string | undefined>();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [companions, setCompanions] = useState<CompanionType>("couple");
  const [budget, setBudget] = useState("");
  const [styles, setStyles] = useState<TravelStyle[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const step = STEPS[stepIdx];
  const selectedDest = destinationId ? findDestination(destinationId) : null;

  const nights = startDate && endDate ? calcNights(startDate, endDate) : null;

  const finish = useCallback(() => {
    const trip = createTrip({
      destination: destination.trim() || undefined,
      destinationId,
      startDate: startDate || null,
      endDate: endDate || null,
      nights,
      companions,
      budget: budget ? parseInt(budget) : null,
      styles,
    });
    router.push(`/woorld/${trip.id}`);
  }, [destination, destinationId, startDate, endDate, nights, companions, budget, styles, router]);

  const goTo = useCallback((idx: number, dir: "next" | "prev") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStepIdx(idx);
      setAnimating(false);
    }, 150);
  }, [animating]);

  const next = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      goTo(stepIdx + 1, "next");
    } else {
      finish();
    }
  }, [stepIdx, goTo, finish]);

  const prev = useCallback(() => {
    if (stepIdx > 0) goTo(stepIdx - 1, "prev");
    else router.push("/woorld");
  }, [stepIdx, goTo, router]);

  const toggleStyle = (s: TravelStyle) => {
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const selectDestination = (dest: Destination) => {
    setDestination(dest.name);
    setDestinationId(dest.id);
    setSearchQuery("");
    setShowSuggestions(false);
    next();
  };

  // Auto-focus first input
  useEffect(() => {
    if (!animating && stepRef.current) {
      const input = stepRef.current.querySelector("input[type='text']");
      if (input) setTimeout(() => (input as HTMLInputElement).focus(), 50);
    }
  }, [stepIdx, animating]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchDestinations(searchQuery).slice(0, 6);
  }, [searchQuery]);

  // Smart recommendations
  const recommendedDests = useMemo((): Destination[] => {
    if (styles.length > 0) return getDestinationsByStyle(styles).slice(0, 6);
    if (budget) {
      const perDay = parseInt(budget) / 3; // Assume 3 nights
      return DESTINATIONS.filter(d => d.budgetPerDayKRW.couple <= perDay).slice(0, 6);
    }
    return getTrendingDestinations();
  }, [styles, budget]);

  // Budget recommendation based on destination
  const budgetRecommendation = useMemo(() => {
    if (!selectedDest || !nights) return null;
    const key = companions === "solo" ? "solo" : "couple";
    const perDay = selectedDest.budgetPerDayKRW[key];
    const totalNights = nights;
    const min = perDay * totalNights;
    const max = Math.round(perDay * totalNights * 1.5);
    return { min, max, perDay };
  }, [selectedDest, nights, companions]);

  // Duration recommendation
  const durationRecs = useMemo(() => {
    if (!selectedDest) return [];
    const key = companions === "solo" ? "solo" : "couple";
    return selectedDest.recommendedNights.map(n => {
      const min = selectedDest.budgetPerDayKRW[key] * n;
      const max = Math.round(min * 1.5);
      return { nights: n, min, max };
    });
  }, [selectedDest, companions]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Top bar */}
      <div className="px-5 pt-6 pb-2 flex items-center justify-between">
        <button
          onClick={prev}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          aria-label={stepIdx === 0 ? "취소하고 돌아가기" : "이전 단계"}
        >
          &larr; {stepIdx === 0 ? "취소" : "이전"}
        </button>
        <button
          onClick={finish}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          aria-label="건너뛰고 바로 시작하기"
        >
          일단 시작하기 &rarr;
        </button>
      </div>

      {/* Progress */}
      <div className="px-8 py-3">
        <div className="flex gap-1.5 justify-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                background: i <= stepIdx ? "#1a1a1a" : "#e5e5e5",
                width: i === stepIdx ? 28 : 12,
                opacity: i <= stepIdx ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-2">
          {stepIdx + 1} / {STEPS.length}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-5 pb-20 max-w-md mx-auto w-full overflow-y-auto">
        <div
          ref={stepRef}
          className="w-full transition-all duration-150 pt-4"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === "next" ? "20px" : "-20px"})`
              : "translateX(0)",
          }}
        >
          {/* ─── Step 1: Destination ─── */}
          {step === "destination" && (
            <div className="w-full text-center">
              <span className="text-4xl mb-4 block">✈️</span>
              <h2 className="text-xl font-bold mb-2">어디로?</h2>
              <p className="text-sm text-gray-400 mb-6">도시 이름을 검색하거나 추천받기</p>

              {/* Search input */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery || destination}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setDestination(e.target.value);
                    setDestinationId(undefined);
                    setShowSuggestions(true);
                  }}
                  placeholder="예: 오사카, 제주, 파리..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-base focus:outline-none focus:border-gray-400 bg-white"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (searchResults.length > 0) selectDestination(searchResults[0]);
                      else next();
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  aria-label="여행 목적지 검색"
                />

                {/* Autocomplete dropdown */}
                {showSuggestions && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-20">
                    {searchResults.map(d => (
                      <button
                        key={d.id}
                        onClick={() => selectDestination(d)}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-lg">{d.emoji}</span>
                        <div>
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-[10px] text-gray-400">{d.country} · {d.recommendedNights[0]}~{d.recommendedNights[d.recommendedNights.length - 1]}박 추천</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {!searchQuery && (
                <>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-xs text-indigo-500 hover:text-indigo-600 mb-4 transition-colors"
                  >
                    ✨ 추천해줘
                  </button>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {recommendedDests.map(d => (
                      <button
                        key={d.id}
                        onClick={() => selectDestination(d)}
                        className="p-3 rounded-xl border border-gray-100 bg-white text-left hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.97]"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{d.emoji}</span>
                          <span className="text-sm font-semibold">{d.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {d.recommendedNights[0]}박 약 {d.budgetPerDayKRW.couple * d.recommendedNights[0]}만
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {d.styles.slice(0, 2).map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">
                              {STYLE_OPTIONS.find(o => o.value === s)?.emoji} {STYLE_OPTIONS.find(o => o.value === s)?.label}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button onClick={next} className="mt-6 px-6 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
                {destination.trim() ? "다음 →" : "아직 안 정했어 →"}
              </button>
            </div>
          )}

          {/* ─── Step 2: Dates ─── */}
          {step === "dates" && (
            <div className="w-full text-center">
              <span className="text-4xl mb-4 block">📅</span>
              <h2 className="text-xl font-bold mb-2">언제/며칠?</h2>
              <p className="text-sm text-gray-400 mb-6">출발일과 돌아오는 날을 탭하세요</p>

              <Calendar
                startDate={startDate}
                endDate={endDate}
                onSelect={(s, e) => { setStartDate(s); setEndDate(e); }}
              />

              {/* Duration recommendations */}
              {durationRecs.length > 0 && !startDate && (
                <div className="mt-6">
                  <p className="text-xs text-gray-400 mb-2">✨ 추천 일정</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {durationRecs.map(r => (
                      <button
                        key={r.nights}
                        onClick={() => {
                          const today = new Date();
                          today.setDate(today.getDate() + 14); // Default 2 weeks from now
                          const start = today.toISOString().split("T")[0];
                          const end = new Date(today);
                          end.setDate(end.getDate() + r.nights);
                          setStartDate(start);
                          setEndDate(end.toISOString().split("T")[0]);
                        }}
                        className="px-4 py-2 rounded-xl border border-gray-100 bg-white text-xs hover:border-gray-200 transition-all active:scale-95"
                      >
                        <p className="font-semibold">{selectedDest?.name} {r.nights}박{r.nights + 1}일</p>
                        <p className="text-gray-400 mt-0.5">{r.min}~{r.max}만원</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={next} className="mt-6 px-6 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
                {startDate ? "다음 →" : "아직 안 정했어 →"}
              </button>
            </div>
          )}

          {/* ─── Step 3: Companions ─── */}
          {step === "companions" && (
            <div className="w-full text-center">
              <span className="text-4xl mb-4 block">👥</span>
              <h2 className="text-xl font-bold mb-2">누구랑?</h2>
              <p className="text-sm text-gray-400 mb-6">여행 동행</p>
              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                {COMPANION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCompanions(opt.value)}
                    className="px-4 py-4 rounded-xl border-2 transition-all text-center active:scale-95"
                    style={{
                      borderColor: companions === opt.value ? "#1a1a1a" : "#e5e5e5",
                      background: companions === opt.value ? "#1a1a1a" : "#fff",
                      color: companions === opt.value ? "#fff" : "#1a1a1a",
                    }}
                    aria-pressed={companions === opt.value}
                  >
                    <span className="text-2xl block mb-1">{opt.emoji}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={next} className="mt-5 px-6 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
                다음 &rarr;
              </button>
            </div>
          )}

          {/* ─── Step 4: Budget ─── */}
          {step === "budget" && (
            <div className="w-full text-center">
              <span className="text-4xl mb-4 block">💰</span>
              <h2 className="text-xl font-bold mb-2">예산은?</h2>
              <p className="text-sm text-gray-400 mb-6">총 예산 (만원)</p>

              <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                <input
                  type="number"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder={budgetRecommendation ? String(budgetRecommendation.min) : "100"}
                  className="w-40 px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl font-bold focus:outline-none focus:border-gray-400 bg-white"
                  onKeyDown={e => e.key === "Enter" && next()}
                  aria-label="총 예산 (만원)"
                />
                <span className="text-sm text-gray-400">만원</span>
              </div>

              {/* Budget recommendation */}
              {budgetRecommendation && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2">
                    ✨ {selectedDest?.name} {nights}박 {companions === "solo" ? "혼자" : "커플"} 기준 약 {budgetRecommendation.min}~{budgetRecommendation.max}만원
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setBudget(String(budgetRecommendation.min))}
                      className="px-4 py-2 rounded-xl border border-gray-100 bg-white text-xs hover:border-gray-200 transition-all active:scale-95"
                    >
                      절약 {budgetRecommendation.min}만
                    </button>
                    <button
                      onClick={() => setBudget(String(Math.round((budgetRecommendation.min + budgetRecommendation.max) / 2)))}
                      className="px-4 py-2 rounded-xl border border-gray-100 bg-white text-xs hover:border-gray-200 transition-all active:scale-95"
                    >
                      보통 {Math.round((budgetRecommendation.min + budgetRecommendation.max) / 2)}만
                    </button>
                    <button
                      onClick={() => setBudget(String(budgetRecommendation.max))}
                      className="px-4 py-2 rounded-xl border border-gray-100 bg-white text-xs hover:border-gray-200 transition-all active:scale-95"
                    >
                      여유 {budgetRecommendation.max}만
                    </button>
                  </div>
                </div>
              )}

              <button onClick={next} className="mt-6 px-6 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
                {budget ? "다음 →" : "상관없어 →"}
              </button>
            </div>
          )}

          {/* ─── Step 5: Styles ─── */}
          {step === "styles" && (
            <div className="w-full text-center">
              <span className="text-4xl mb-4 block">🎯</span>
              <h2 className="text-xl font-bold mb-2">어떤 여행?</h2>
              <p className="text-sm text-gray-400 mb-6">여러 개 선택 가능</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
                {STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStyle(opt.value)}
                    className="px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all active:scale-95"
                    style={{
                      borderColor: styles.includes(opt.value) ? "#1a1a1a" : "#e5e5e5",
                      background: styles.includes(opt.value) ? "#1a1a1a" : "#fff",
                      color: styles.includes(opt.value) ? "#fff" : "#555",
                    }}
                    aria-pressed={styles.includes(opt.value)}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={finish}
                className="mt-8 px-8 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 active:scale-95 transition-all"
              >
                여행 만들기
              </button>
              <div>
                <button onClick={() => { setStyles([]); finish(); }} className="mt-2 text-xs text-gray-300 hover:text-gray-500 transition-colors py-1">
                  건너뛰기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
