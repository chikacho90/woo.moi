"use client";

import { useState } from "react";
import type { Spot, SmokerRating, ResidentReason } from "../types";
import { STATUS_LABEL } from "../types";

type Props = {
  spot: Spot;
  onClose: () => void;
  onAction: () => void;
};

export default function SpotSheet({ spot, onClose, onAction }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showReasons, setShowReasons] = useState(false);

  const am = spot.amenities;
  const amenityList = [
    am.ashtray && "재떨이",
    am.chair && "의자",
    am.roof && "지붕",
    am.size === "large" && "넓음",
    am.size === "medium" && "중간",
    am.size === "small" && "좁음",
  ].filter(Boolean);

  async function rate(rating: SmokerRating) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/smokemap/spots/${spot.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setMsg("평가 완료");
      onAction();
      setTimeout(onClose, 700);
    } catch {
      setMsg("실패");
    } finally {
      setBusy(false);
    }
  }

  async function complain(reason?: ResidentReason) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/smokemap/spots/${spot.id}/complain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setMsg("제보 완료");
      onAction();
      setTimeout(onClose, 700);
    } catch {
      setMsg("실패");
    } finally {
      setBusy(false);
      setShowReasons(false);
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
            <div>
              <h2 className="text-base font-semibold">
                {spot.name || "등록된 흡연구역"}
              </h2>
              {spot.address && (
                <p className="text-xs text-gray-500 mt-0.5">{spot.address}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium">{STATUS_LABEL[spot.status]}</span>
            {spot.isOfficial && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">
                공식 지정
              </span>
            )}
          </div>

          {amenityList.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1.5">편의시설</div>
              <div className="flex flex-wrap gap-1.5">
                {amenityList.map((a) => (
                  <span
                    key={a as string}
                    className="text-[11px] bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-full"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mb-1">
                흡연자 긍정
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {spot.positiveCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <div className="text-[10px] text-red-700 dark:text-red-300 mb-1">
                주민 불편
              </div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {spot.complaintCount}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">흡연자 평가</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={busy}
                onClick={() => rate("comfortable")}
                className="py-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm hover:bg-emerald-200 disabled:opacity-50 transition"
              >
                🟢 쾌적
              </button>
              <button
                disabled={busy}
                onClick={() => rate("ok")}
                className="py-2.5 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 disabled:opacity-50 transition"
              >
                ⚪ OK
              </button>
              <button
                disabled={busy}
                onClick={() => rate("inappropriate")}
                className="py-2.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm hover:bg-red-200 disabled:opacity-50 transition"
              >
                🔴 부적절
              </button>
            </div>

            <div className="text-xs text-gray-500 pt-2">주민/비흡연자</div>
            {!showReasons ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={() => complain()}
                  className="py-2.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm hover:bg-orange-200 disabled:opacity-50 transition"
                >
                  ⚠️ 불편 신고
                </button>
                <button
                  disabled={busy}
                  onClick={() => setShowReasons(true)}
                  className="py-2.5 rounded-lg bg-white dark:bg-neutral-800 border border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300 text-sm hover:bg-orange-50 disabled:opacity-50 transition"
                >
                  사유 선택
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { k: "smoke", l: "연기·냄새" },
                    { k: "butts", l: "꽁초 투기" },
                    { k: "sensitive_area", l: "민감지역" },
                    { k: "other", l: "기타" },
                  ] as { k: ResidentReason; l: string }[]
                ).map(({ k, l }) => (
                  <button
                    key={k}
                    disabled={busy}
                    onClick={() => complain(k)}
                    className="py-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 text-xs hover:bg-orange-100 disabled:opacity-50 transition"
                  >
                    {l}
                  </button>
                ))}
                <button
                  onClick={() => setShowReasons(false)}
                  className="col-span-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          {msg && (
            <p className="text-xs text-center mt-3 text-gray-500">{msg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
