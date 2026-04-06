"use client";
import { useState } from "react";
import type { Card, CardCategory, SlotType, TripDay } from "../types";
import { SLOT_TYPES, CATEGORY_COLORS } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (card: Card) => void;
  days: TripDay[];
  areas?: string[];
}

const CATEGORIES: CardCategory[] = [
  "transport",
  "accommodation",
  "activity",
  "food",
  "chill",
  "errand",
];

export default function AddCardModal({ open, onClose, onAdd, days, areas = [] }: Props) {
  const [emoji, setEmoji] = useState("📌");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CardCategory>("activity");
  const [compatibleSlots, setCompatibleSlots] = useState<SlotType[]>([...SLOT_TYPES]);
  const [compatibleAreas, setCompatibleAreas] = useState<string[]>(["any"]);
  const [recommendedDays, setRecommendedDays] = useState<number[]>([]);
  const [recommendedSlot, setRecommendedSlot] = useState<SlotType | "">("");
  const [requiresReservation, setRequiresReservation] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState("");

  if (!open) return null;

  const toggleSlot = (s: SlotType) => {
    setCompatibleSlots((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const areaOptions = ["any", ...areas.filter((a) => a !== "any")];
  const toggleArea = (a: string) => {
    if (a === "any") {
      setCompatibleAreas(["any"]);
      return;
    }
    setCompatibleAreas((prev) => {
      const without = prev.filter((x) => x !== "any");
      if (prev.includes(a)) {
        const next = without.filter((x) => x !== a);
        return next.length === 0 ? ["any"] : next;
      }
      return [...without, a];
    });
  };

  const toggleDay = (idx: number) => {
    setRecommendedDays((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const cat = CATEGORY_COLORS[category];
    onAdd({
      id: crypto.randomUUID(),
      emoji,
      name: name.trim(),
      description: description.trim(),
      category,
      tags: [{ label: cat.label, color: cat.text, bg: cat.bg }],
      compatibleSlots,
      compatibleAreas,
      recommendedDayIndex: recommendedDays.length > 0 ? recommendedDays : undefined,
      recommendedSlot: recommendedSlot || undefined,
      estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
      requiresReservation,
      reservationStatus: requiresReservation ? "none" : undefined,
    });
    // reset
    setEmoji("📌");
    setName("");
    setDescription("");
    setCategory("activity");
    setCompatibleSlots([...SLOT_TYPES]);
    setCompatibleAreas(["any"]);
    setRecommendedDays([]);
    setRecommendedSlot("");
    setEstimatedCost("");
    setRequiresReservation(false);
    onClose();
  };

  const chipStyle = (active: boolean) => ({
    background: active ? "rgba(255,255,255,0.15)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.4)",
    border: `1px solid ${active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
        style={{ background: "#16161e", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "#fff" }}>
          카드 추가
        </h2>

        <div className="space-y-3">
          {/* 이모지 + 이름 */}
          <div className="flex gap-2">
            <div className="w-14">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                이모지
              </label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full rounded-lg px-2 py-2 text-center text-lg outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 야에야마 소바"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              설명
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="짧은 설명"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              카테고리
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="px-2.5 py-1 rounded-full text-xs"
                  style={{
                    background: category === c ? CATEGORY_COLORS[c].bg : "transparent",
                    color: category === c ? CATEGORY_COLORS[c].text : "rgba(255,255,255,0.4)",
                    border: `1px solid ${category === c ? CATEGORY_COLORS[c].text + "40" : "rgba(255,255,255,0.08)"}`,
                    fontWeight: category === c ? 600 : 400,
                  }}
                >
                  {CATEGORY_COLORS[c].label}
                </button>
              ))}
            </div>
          </div>

          {/* 예상 비용 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              예상 비용 (선택)
            </label>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* 호환 시간대 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              호환 시간대
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SLOT_TYPES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSlot(s)}
                  className="px-2.5 py-1 rounded-full text-xs"
                  style={chipStyle(compatibleSlots.includes(s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 호환 위치 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              호환 위치
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {areaOptions.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleArea(a)}
                  className="px-2.5 py-1 rounded-full text-xs"
                  style={chipStyle(
                    compatibleAreas.includes(a) ||
                      (a === "any" && compatibleAreas.includes("any"))
                  )}
                >
                  {a === "any" ? "어디든" : a}
                </button>
              ))}
            </div>
          </div>

          {/* 추천 날짜 */}
          {days.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                추천 날짜 (선택)
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {days.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDay(d.index)}
                    className="px-2.5 py-1 rounded-full text-xs"
                    style={chipStyle(recommendedDays.includes(d.index))}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 추천 시간대 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              추천 시간대 (선택)
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SLOT_TYPES.map((s) => (
                <button
                  key={s}
                  onClick={() => setRecommendedSlot(recommendedSlot === s ? "" : s)}
                  className="px-2.5 py-1 rounded-full text-xs"
                  style={chipStyle(recommendedSlot === s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 예약 필요 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresReservation}
              onChange={(e) => setRequiresReservation(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              예약 필요
            </span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{
              background: name.trim() ? "#fff" : "rgba(255,255,255,0.1)",
              color: name.trim() ? "#0a0a12" : "rgba(255,255,255,0.3)",
            }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
