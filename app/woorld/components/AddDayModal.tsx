"use client";
import { useState } from "react";
import type { TripDay } from "../types";
import { DAY_COLORS, AREA_OPTIONS } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (day: TripDay) => void;
  nextIndex: number;
}

export default function AddDayModal({ open, onClose, onAdd, nextIndex }: Props) {
  const [label, setLabel] = useState(`Day ${nextIndex + 1}`);
  const [date, setDate] = useState("");
  const [area, setArea] = useState("any");
  const [customArea, setCustomArea] = useState("");
  const [color, setColor] = useState(DAY_COLORS[nextIndex % DAY_COLORS.length]);

  if (!open) return null;

  const handleSubmit = () => {
    onAdd({
      id: crypto.randomUUID(),
      index: nextIndex,
      date: date || null,
      label: label || `Day ${nextIndex + 1}`,
      area: area === "custom" ? customArea : area,
      color,
    });
    setLabel(`Day ${nextIndex + 2}`);
    setDate("");
    setArea("any");
    setCustomArea("");
    setColor(DAY_COLORS[(nextIndex + 1) % DAY_COLORS.length]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm mx-4"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "#1a1a1a" }}>
          날짜 추가
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#555" }}>
              라벨
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: "#ddd", color: "#1a1a1a" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#555" }}>
              날짜 (선택)
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              style={{ borderColor: "#ddd", color: "#1a1a1a" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#555" }}>
              위치
            </label>
            <div className="flex gap-2 flex-wrap">
              {AREA_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => setArea(a)}
                  className="px-3 py-1 rounded-full text-sm border"
                  style={{
                    background: area === a ? "#1a1a1a" : "#fff",
                    color: area === a ? "#fff" : "#555",
                    borderColor: area === a ? "#1a1a1a" : "#ddd",
                  }}
                >
                  {a === "any" ? "어디든" : a}
                </button>
              ))}
              <button
                onClick={() => setArea("custom")}
                className="px-3 py-1 rounded-full text-sm border"
                style={{
                  background: area === "custom" ? "#1a1a1a" : "#fff",
                  color: area === "custom" ? "#fff" : "#555",
                  borderColor: area === "custom" ? "#1a1a1a" : "#ddd",
                }}
              >
                직접입력
              </button>
            </div>
            {area === "custom" && (
              <input
                type="text"
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                placeholder="위치를 입력하세요"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
                style={{ borderColor: "#ddd", color: "#1a1a1a" }}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#555" }}>
              컬러
            </label>
            <div className="flex gap-2">
              {DAY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2"
                  style={{
                    background: c,
                    borderColor: color === c ? "#1a1a1a" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm border"
            style={{ borderColor: "#ddd", color: "#555" }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: "#1a1a1a", color: "#fff" }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
