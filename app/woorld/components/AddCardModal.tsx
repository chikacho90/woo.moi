"use client";
import { useState } from "react";
import type { Card, CardCategory, SlotType, TripDay } from "../types";
import { CATEGORY_COLORS, SLOT_TYPES } from "../types";

const AREA_OPTIONS = ["any", "시내", "리조트", "공항"];

interface Props {
  days: TripDay[];
  onAdd: (card: Omit<Card, "id">) => void;
  onClose: () => void;
}

export default function AddCardModal({ days, onAdd, onClose }: Props) {
  const [emoji, setEmoji] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CardCategory>("activity");
  const [compatibleSlots, setCompatibleSlots] = useState<SlotType[]>([...SLOT_TYPES]);
  const [compatibleAreas, setCompatibleAreas] = useState<string[]>(["any"]);
  const [recommendedDays, setRecommendedDays] = useState<number[]>([]);
  const [recommendedSlot, setRecommendedSlot] = useState<SlotType | "">("");
  const [requiresReservation, setRequiresReservation] = useState(false);

  const toggleSlot = (s: SlotType) => {
    setCompatibleSlots(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleArea = (a: string) => {
    if (a === "any") {
      setCompatibleAreas(["any"]);
    } else {
      setCompatibleAreas(prev => {
        const without = prev.filter(x => x !== "any");
        return without.includes(a) ? without.filter(x => x !== a) : [...without, a];
      });
    }
  };

  const toggleDay = (idx: number) => {
    setRecommendedDays(prev =>
      prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      emoji: emoji || "📌",
      name: name.trim(),
      description: description.trim(),
      category,
      tags: [],
      compatibleSlots,
      compatibleAreas: compatibleAreas.length === 0 ? ["any"] : compatibleAreas,
      recommendedDayIndex: recommendedDays.length > 0 ? recommendedDays : undefined,
      recommendedSlot: recommendedSlot || undefined,
      requiresReservation,
      reservationStatus: requiresReservation ? "none" : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-bold text-gray-900">카드 추가</h3>

        {/* Emoji + Name */}
        <div className="flex gap-2">
          <div className="w-16">
            <label className="text-xs font-medium text-gray-500 mb-1 block">이모지</label>
            <input
              type="text"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              placeholder="🏝️"
              className="w-full border border-gray-200 rounded-xl px-2 py-2.5 text-center text-lg focus:outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="액티비티 이름"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">설명</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="짧은 설명"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">카테고리</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(CATEGORY_COLORS) as [CardCategory, typeof CATEGORY_COLORS[CardCategory]][]).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: category === key ? val.text : val.bg,
                  color: category === key ? "#fff" : val.text,
                }}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compatible Slots */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">호환 시간대</label>
          <div className="flex flex-wrap gap-1.5">
            {SLOT_TYPES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSlot(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  compatibleSlots.includes(s)
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Compatible Areas */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">호환 위치</label>
          <div className="flex flex-wrap gap-1.5">
            {AREA_OPTIONS.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => toggleArea(a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  compatibleAreas.includes(a)
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {a === "any" ? "어디든" : a}
              </button>
            ))}
          </div>
        </div>

        {/* Recommended Days */}
        {days.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">추천 날짜 (선택)</label>
            <div className="flex flex-wrap gap-1.5">
              {days.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    recommendedDays.includes(d.index)
                      ? "text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  style={recommendedDays.includes(d.index) ? { backgroundColor: d.color } : undefined}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Slot */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">추천 시간대 (선택)</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setRecommendedSlot("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !recommendedSlot ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              없음
            </button>
            {SLOT_TYPES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setRecommendedSlot(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  recommendedSlot === s
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Reservation */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requiresReservation}
            onChange={e => setRequiresReservation(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-xs text-gray-600">예약 필요</span>
        </label>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors disabled:opacity-30"
          >
            추가
          </button>
        </div>
      </form>
    </div>
  );
}
