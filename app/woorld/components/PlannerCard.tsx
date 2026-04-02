"use client";
import { useState } from "react";
import type { Card, Placement } from "../types";
import { CATEGORY_COLORS } from "../types";

interface Props {
  card: Card;
  placement?: Placement;
  compact?: boolean;
  isDragging?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onTap?: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
  onRemove?: () => void;
}

export default function PlannerCard({
  card, placement, compact, isDragging, isHighlighted, isDimmed,
  onDragStart, onTap, onLock, onUnlock, onRemove,
}: Props) {
  const [showActions, setShowActions] = useState(false);
  const cat = CATEGORY_COLORS[card.category];
  const isLocked = placement?.status === "locked";
  const isPlaced = !!placement;

  return (
    <div
      draggable={!isLocked}
      onDragStart={e => {
        if (isLocked) { e.preventDefault(); return; }
        onDragStart?.(e);
      }}
      onClick={() => {
        if (isPlaced) {
          setShowActions(prev => !prev);
        } else {
          onTap?.();
        }
      }}
      onMouseEnter={() => isPlaced && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`relative rounded-xl ${compact ? "px-1.5 py-1" : "px-3 py-2.5"} text-left transition-all select-none ${
        isDragging ? "opacity-40 scale-95" : ""
      } ${isDimmed ? "opacity-30" : ""} ${
        isHighlighted ? "ring-2 ring-blue-400 ring-offset-1" : ""
      } ${isLocked ? "border-l-[3px]" : ""}`}
      style={{
        backgroundColor: cat.bg,
        borderColor: isLocked ? cat.text : `${cat.text}30`,
        borderWidth: isLocked ? undefined : "1px",
        borderStyle: "solid",
        cursor: isLocked ? "default" : "grab",
      }}
    >
      {/* Actions (hover/tap) */}
      {showActions && isPlaced && (
        <div className="absolute -top-1 -right-1 flex gap-0.5 z-10">
          {isLocked ? (
            <button
              onClick={e => { e.stopPropagation(); onUnlock?.(); }}
              className="w-6 h-6 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center text-[10px] hover:bg-gray-50 active:scale-90"
              title="잠금 해제"
            >
              🔓
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onLock?.(); }}
              className="w-6 h-6 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center text-[10px] hover:bg-gray-50 active:scale-90"
              title="고정"
            >
              🔒
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onRemove?.(); }}
            className="w-6 h-6 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center text-[10px] hover:bg-red-50 active:scale-90"
            title="제거"
          >
            ✕
          </button>
        </div>
      )}

      <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
        <span className={compact ? "text-sm" : "text-base leading-none mt-0.5"}>{card.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold leading-tight truncate ${compact ? "text-[10px]" : "text-[13px]"}`} style={{ color: cat.text }}>
            {card.name}
          </p>
          {!compact && card.description && (
            <p className="text-[11px] mt-0.5 truncate" style={{ color: `${cat.text}99` }}>
              {card.description}
            </p>
          )}
          {!compact && card.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {card.tags.map((t, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: t.bg, color: t.color }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {card.requiresReservation && (
        <div className="mt-1.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
            card.reservationStatus === "confirmed"
              ? "bg-green-100 text-green-700"
              : card.reservationStatus === "pending"
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-500"
          }`}>
            {card.reservationStatus === "confirmed" ? "예약완료" : card.reservationStatus === "pending" ? "예약대기" : "예약필요"}
          </span>
        </div>
      )}
    </div>
  );
}
