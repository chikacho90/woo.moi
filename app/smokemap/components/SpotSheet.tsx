"use client";

import { useState } from "react";
import type { Spot, ResidentReason } from "../types";
import { STATUS_LABEL } from "../types";
import MapLinkModal from "./MapLinkModal";

type Props = {
  spot: Spot;
  onClose: () => void;
  onAction: () => void;
};

type Amen = { key: string; emoji: string; label: string; on: boolean };

export default function SpotSheet({ spot, onClose, onAction }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showComplain, setShowComplain] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  const am = spot.amenities;
  const amenChips: Amen[] = [
    { key: "ashtray", emoji: "🗑️", label: "재떨이", on: !!am.ashtray },
    { key: "chair", emoji: "🪑", label: "앉을 곳", on: !!am.chair },
    { key: "roof", emoji: "🏠", label: "지붕 있음", on: !!am.roof },
    { key: "size-lg", emoji: "↔️", label: "공간 넓음", on: am.size === "large" },
    { key: "size-md", emoji: "➖", label: "공간 중간", on: am.size === "medium" },
    { key: "size-sm", emoji: "📏", label: "공간 좁음", on: am.size === "small" },
  ].filter((a) => a.on);

  const categoryLabel = spot.isOfficial ? "공식 지정 흡연구역" : "사용자 제보";

  async function rate(rating: "comfortable" | "ok" | "inappropriate") {
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
      setMsg(rating === "inappropriate" ? "의견 접수됨" : "응답 완료");
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
      setShowComplain(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[9000]" onClick={onClose}>
        <div className="absolute inset-0 bg-black/20" />
        <div
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl shadow-xl max-h-[88vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 드래그 핸들 */}
          <div className="pt-2 pb-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-neutral-700" />
          </div>

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto px-5 pt-2">
            {/* 카테고리 칩 + 닫기 */}
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  spot.isOfficial
                    ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {categoryLabel}
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 제목 + 주소 */}
            <h2 className="text-lg font-semibold leading-tight">
              {spot.name || "등록된 흡연구역"}
            </h2>
            {spot.address && (
              <p className="text-xs text-gray-500 mt-1">{spot.address}</p>
            )}

            {/* 상태 + 긍정/불편 요약 */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm font-medium">
                {STATUS_LABEL[spot.status]}
              </span>
              <span className="text-[11px] text-gray-500">
                흡연가능 {spot.positiveCount} · 불편 {spot.complaintCount}
              </span>
            </div>

            {/* 편의시설 칩 */}
            {amenChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {amenChips.map((a) => (
                  <span
                    key={a.key}
                    className="text-[11px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full"
                  >
                    {a.emoji} {a.label}
                  </span>
                ))}
              </div>
            )}

            {/* 길 안내 + 저장 */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowRoute(true)}
                className="flex-1 py-3 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition"
              >
                🧭 길 안내
              </button>
              <button
                disabled
                className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-400 text-sm"
                title="곧 지원"
              >
                ☆ 저장
              </button>
            </div>

            {/* 사진 영역 플레이스홀더 */}
            <div className="mt-4 border border-dashed border-gray-200 dark:border-neutral-700 rounded-lg py-6 text-center">
              <p className="text-xs text-gray-400">사진 업로드는 곧 지원돼요</p>
            </div>

            {/* 주민 신고 */}
            <div className="mt-4 border-t border-gray-100 dark:border-neutral-800 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">주민·비흡연자</div>
                {spot.isOfficial && (
                  <div className="text-[10px] text-blue-600 dark:text-blue-400">
                    공식 지정은 핀 유지
                  </div>
                )}
              </div>
              {!showComplain ? (
                <button
                  onClick={() => setShowComplain(true)}
                  disabled={busy}
                  className="mt-2 w-full py-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 text-sm hover:bg-orange-100 disabled:opacity-50 transition"
                >
                  ⚠️ 이곳이 불편해요
                </button>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
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
                    onClick={() => setShowComplain(false)}
                    className="col-span-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            {/* 사라진 흡연구역 */}
            <button
              onClick={() => rate("inappropriate")}
              disabled={busy}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              사라진 흡연구역인가요?
            </button>

            {msg && (
              <p className="text-xs text-center mt-3 text-gray-500">{msg}</p>
            )}

            <div className="h-20" />
          </div>

          {/* Sticky 하단 CTA */}
          <div className="border-t border-gray-100 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
            <p className="text-xs text-center text-gray-500 mb-2">
              이곳에서 흡연이 가능했나요?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={() => rate("inappropriate")}
                className="py-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 disabled:opacity-50 transition"
              >
                아니오
              </button>
              <button
                disabled={busy}
                onClick={() => rate("ok")}
                className="py-3 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                예
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRoute && (
        <MapLinkModal
          lat={spot.lat}
          lng={spot.lng}
          name={spot.name}
          onClose={() => setShowRoute(false)}
        />
      )}
    </>
  );
}
