"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createTrip, type CompanionType, type TravelStyle } from "../store/trips";

const STEPS = ["destination", "dates", "nights", "companions", "budget", "styles"] as const;
type Step = (typeof STEPS)[number];

const COMPANION_OPTIONS: { value: CompanionType; emoji: string; label: string }[] = [
  { value: "solo", emoji: "🧳", label: "혼자" },
  { value: "couple", emoji: "💑", label: "커플" },
  { value: "friends", emoji: "👯", label: "친구" },
  { value: "family", emoji: "👨‍👩‍👧", label: "가족" },
];

const STYLE_OPTIONS: { value: TravelStyle; emoji: string; label: string }[] = [
  { value: "food", emoji: "🍽", label: "맛집탐방" },
  { value: "activity", emoji: "🏄", label: "액티비티" },
  { value: "relax", emoji: "🧘", label: "힐링" },
  { value: "sightseeing", emoji: "📸", label: "관광" },
  { value: "shopping", emoji: "🛍", label: "쇼핑" },
  { value: "nature", emoji: "🌿", label: "자연" },
  { value: "culture", emoji: "🎭", label: "문화체험" },
];

export default function NewTripPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);

  // Form state
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [nights, setNights] = useState("");
  const [companions, setCompanions] = useState<CompanionType>("couple");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [styles, setStyles] = useState<TravelStyle[]>([]);

  const step = STEPS[stepIdx];

  const next = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      finish();
    }
  }, [stepIdx, destination, startDate, endDate, nights, companions, budgetMin, budgetMax, styles]);

  const prev = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else router.push("/woorld");
  };

  const finish = () => {
    const trip = createTrip({
      destination: destination.trim() || undefined,
      startDate: startDate || null,
      endDate: endDate || null,
      nights: nights ? parseInt(nights) : null,
      companions,
      budget: budgetMin || budgetMax
        ? { min: parseInt(budgetMin) || 0, max: parseInt(budgetMax) || 0 }
        : null,
      styles,
    });
    router.push(`/woorld/${trip.id}`);
  };

  const toggleStyle = (s: TravelStyle) => {
    setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fafaf8", color: "#1a1a1a" }}>
      {/* Top bar */}
      <div className="px-5 pt-6 pb-2 flex items-center justify-between">
        <button onClick={prev} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← {stepIdx === 0 ? "취소" : "이전"}
        </button>
        <button onClick={finish} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          일단 시작하기 →
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 py-3">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              background: i === stepIdx ? "#1a1a1a" : i < stepIdx ? "#aaa" : "#ddd",
              width: i === stepIdx ? 20 : 8,
            }}
          />
        ))}
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-20 max-w-md mx-auto w-full">
        {step === "destination" && (
          <div className="w-full text-center">
            <span className="text-4xl mb-4 block">✈️</span>
            <h2 className="text-xl font-bold mb-2">어디로 떠나고 싶어?</h2>
            <p className="text-sm text-gray-400 mb-6">도시나 나라 이름을 입력해줘</p>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="예: 도쿄, 제주도, 파리..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-base focus:outline-none focus:border-gray-400 bg-white"
              autoFocus
              onKeyDown={e => e.key === "Enter" && next()}
            />
            <button onClick={next} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
              {destination ? "다음 →" : "아직 안 정했어 →"}
            </button>
          </div>
        )}

        {step === "dates" && (
          <div className="w-full text-center">
            <span className="text-4xl mb-4 block">📅</span>
            <h2 className="text-xl font-bold mb-2">언제 갈 거야?</h2>
            <p className="text-sm text-gray-400 mb-6">출발일과 돌아오는 날</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">출발</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400 bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">도착</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400 bg-white"
                />
              </div>
            </div>
            <button onClick={next} className="mt-4 text-xs text-gray-400 hover:text-gray-600">
              {startDate ? "다음 →" : "아직 안 정했어 →"}
            </button>
          </div>
        )}

        {step === "nights" && (
          <div className="w-full text-center">
            <span className="text-4xl mb-4 block">🌙</span>
            <h2 className="text-xl font-bold mb-2">며칠이나?</h2>
            <p className="text-sm text-gray-400 mb-6">숙박 일수</p>
            <input
              type="number"
              min="1"
              max="30"
              value={nights}
              onChange={e => setNights(e.target.value)}
              placeholder="3"
              className="w-32 mx-auto px-4 py-3 rounded-xl border border-gray-200 text-center text-2xl font-bold focus:outline-none focus:border-gray-400 bg-white"
              onKeyDown={e => e.key === "Enter" && next()}
            />
            <span className="text-sm text-gray-400 ml-2">박</span>
            <div>
              <button onClick={next} className="mt-4 text-xs text-gray-400 hover:text-gray-600">
                {nights ? "다음 →" : "모르겠어 →"}
              </button>
            </div>
          </div>
        )}

        {step === "companions" && (
          <div className="w-full text-center">
            <span className="text-4xl mb-4 block">👥</span>
            <h2 className="text-xl font-bold mb-2">누구랑 가?</h2>
            <p className="text-sm text-gray-400 mb-6">여행 동행</p>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              {COMPANION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setCompanions(opt.value); }}
                  className="px-4 py-4 rounded-xl border-2 transition-all text-center"
                  style={{
                    borderColor: companions === opt.value ? "#1a1a1a" : "#e5e5e5",
                    background: companions === opt.value ? "#1a1a1a" : "#fff",
                    color: companions === opt.value ? "#fff" : "#1a1a1a",
                  }}
                >
                  <span className="text-2xl block mb-1">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            <button onClick={next} className="mt-5 text-xs text-gray-400 hover:text-gray-600">
              다음 →
            </button>
          </div>
        )}

        {step === "budget" && (
          <div className="w-full text-center">
            <span className="text-4xl mb-4 block">💰</span>
            <h2 className="text-xl font-bold mb-2">예산은?</h2>
            <p className="text-sm text-gray-400 mb-6">대략적인 범위 (만원)</p>
            <div className="flex gap-3 items-center max-w-xs mx-auto">
              <input
                type="number"
                value={budgetMin}
                onChange={e => setBudgetMin(e.target.value)}
                placeholder="50"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400 bg-white"
              />
              <span className="text-gray-300">~</span>
              <input
                type="number"
                value={budgetMax}
                onChange={e => setBudgetMax(e.target.value)}
                placeholder="200"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:border-gray-400 bg-white"
              />
              <span className="text-xs text-gray-400">만원</span>
            </div>
            <button onClick={next} className="mt-4 text-xs text-gray-400 hover:text-gray-600">
              {budgetMin || budgetMax ? "다음 →" : "상관없어 →"}
            </button>
          </div>
        )}

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
                  className="px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all"
                  style={{
                    borderColor: styles.includes(opt.value) ? "#1a1a1a" : "#e5e5e5",
                    background: styles.includes(opt.value) ? "#1a1a1a" : "#fff",
                    color: styles.includes(opt.value) ? "#fff" : "#555",
                  }}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={finish}
              className="mt-6 px-8 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              여행 만들기 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
