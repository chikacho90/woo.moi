"use client";
import { useState } from "react";
import type { TripDay } from "../types";
import { DAY_COLORS, genId } from "../types";

const AREA_OPTIONS = ["any", "시내", "리조트", "공항"];

interface Props {
  dayCount: number;
  onAdd: (day: Partial<TripDay>) => void;
  onClose: () => void;
}

export default function AddDayModal({ dayCount, onAdd, onClose }: Props) {
  const [label, setLabel] = useState(`Day ${dayCount + 1}`);
  const [date, setDate] = useState("");
  const [area, setArea] = useState("any");
  const [customArea, setCustomArea] = useState("");
  const [color, setColor] = useState(DAY_COLORS[dayCount % DAY_COLORS.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      label: label || `Day ${dayCount + 1}`,
      date: date || null,
      area: area === "custom" ? customArea : area,
      color,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="날짜 추가">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-modalIn"
      >
        <h3 className="text-lg font-bold text-gray-900">날짜 추가</h3>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">라벨</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            placeholder="Day 1"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">날짜 (선택)</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">위치</label>
          <div className="flex flex-wrap gap-2">
            {AREA_OPTIONS.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  area === a
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {a === "any" ? "미정" : a}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setArea("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                area === "custom"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              직접입력
            </button>
          </div>
          {area === "custom" && (
            <input
              type="text"
              value={customArea}
              onChange={e => setCustomArea(e.target.value)}
              placeholder="위치명 입력"
              className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">컬러</label>
          <div className="flex gap-2">
            {DAY_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all ${
                  color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

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
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            추가
          </button>
        </div>
      </form>
    </div>
  );
}
