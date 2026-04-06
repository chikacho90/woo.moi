"use client";
import { useState } from "react";
import type { TripDay } from "../types";
import { DAY_COLORS } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (day: TripDay) => void;
  nextIndex: number;
  areas?: string[];
}

export default function AddDayModal({ open, onClose, onAdd, nextIndex, areas = [] }: Props) {
  const [label, setLabel] = useState(`Day ${nextIndex + 1}`);
  const [date, setDate] = useState("");
  const [area, setArea] = useState("any");
  const [customArea, setCustomArea] = useState("");
  const [color, setColor] = useState(DAY_COLORS[nextIndex % DAY_COLORS.length]);

  const areaOptions = ["any", ...areas.filter((a) => a !== "any")];

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
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm mx-4"
        style={{ background: "#16161e", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "#fff" }}>
          날짜 추가
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              라벨
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              날짜 (선택)
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              위치
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {areaOptions.map((a) => (
                <button
                  key={a}
                  onClick={() => setArea(a)}
                  className="px-2.5 py-1 rounded-full text-xs"
                  style={{
                    background: area === a ? "rgba(255,255,255,0.15)" : "transparent",
                    color: area === a ? "#fff" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${area === a ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {a === "any" ? "어디든" : a}
                </button>
              ))}
              <button
                onClick={() => setArea("custom")}
                className="px-2.5 py-1 rounded-full text-xs"
                style={{
                  background: area === "custom" ? "rgba(255,255,255,0.15)" : "transparent",
                  color: area === "custom" ? "#fff" : "rgba(255,255,255,0.4)",
                  border: `1px solid ${area === "custom" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`,
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
                className="w-full rounded-lg px-3 py-2 text-sm mt-2 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "#e5e5e5", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              컬러
            </label>
            <div className="flex gap-2">
              {DAY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full"
                  style={{
                    background: c,
                    border: color === c ? "2px solid #fff" : "2px solid transparent",
                    boxShadow: color === c ? `0 0 0 1px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
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
            style={{ background: "#fff", color: "#0a0a12" }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
