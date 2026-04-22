"use client";

import { useState } from "react";
import type { Amenities } from "../types";

type Props = {
  lat: number;
  lng: number;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddSpotSheet({ lat, lng, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [ashtray, setAshtray] = useState(false);
  const [chair, setChair] = useState(false);
  const [roof, setRoof] = useState(false);
  const [size, setSize] = useState<"small" | "medium" | "large" | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const amenities: Amenities = { ashtray, chair, roof };
      if (size) amenities.size = size;
      const res = await fetch("/api/smokemap/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          name: name.trim() || null,
          amenities,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message || "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold">🚬 새 흡연구역 등록</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <p className="text-[11px] text-gray-500 mb-4">
            위치: {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>

          <label className="block mb-4">
            <span className="text-xs text-gray-500">이름 (선택)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 강남역 3번 출구 흡연장"
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              maxLength={100}
            />
          </label>

          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2">편의시설</div>
            <div className="grid grid-cols-3 gap-2">
              <Toggle label="재떨이" value={ashtray} onChange={setAshtray} />
              <Toggle label="의자" value={chair} onChange={setChair} />
              <Toggle label="지붕" value={roof} onChange={setRoof} />
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs text-gray-500 mb-2">공간 크기</div>
            <div className="grid grid-cols-3 gap-2">
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(size === s ? "" : s)}
                  className={`py-2 rounded-lg text-xs transition ${
                    size === s
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {s === "small" ? "좁음" : s === "medium" ? "중간" : "넓음"}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={busy}
            onClick={submit}
            className="w-full py-3 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            {busy ? "등록 중..." : "등록"}
          </button>

          {err && (
            <p className="text-xs text-center mt-2 text-red-500">{err}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`py-2 rounded-lg text-xs transition ${
        value
          ? "bg-emerald-500 text-white"
          : "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
      }`}
    >
      {value ? "✓ " : ""}{label}
    </button>
  );
}
