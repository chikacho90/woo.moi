"use client";
import { useRef, useCallback } from "react";
import type { Card, Placement } from "../types";
import { CATEGORY_COLORS } from "../types";

interface Props {
  card: Card;
  placement?: Placement;
  isPool?: boolean;
  isActive?: boolean;
  isDimmed?: boolean;
  onTap?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onLock?: () => void;
  onUnlock?: () => void;
  onRemove?: () => void;
  showActions?: boolean;
  onToggleActions?: () => void;
}

export default function CardChip({
  card,
  placement,
  isPool,
  isActive,
  isDimmed,
  onTap,
  onDragStart,
  onLock,
  onUnlock,
  onRemove,
  showActions,
  onToggleActions,
}: Props) {
  const cat = CATEGORY_COLORS[card.category];
  const isLocked = placement?.status === "locked";
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isLocked) return;
      didLongPress.current = false;
      const touch = e.touches[0];
      const target = e.currentTarget as HTMLElement;

      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        // create ghost
        const ghost = target.cloneNode(true) as HTMLDivElement;
        ghost.style.position = "fixed";
        ghost.style.width = `${target.offsetWidth * 0.85}px`;
        ghost.style.opacity = "0.85";
        ghost.style.zIndex = "9999";
        ghost.style.pointerEvents = "none";
        ghost.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
        ghost.style.transform = "rotate(2deg)";
        ghost.style.left = `${touch.clientX - target.offsetWidth * 0.42}px`;
        ghost.style.top = `${touch.clientY - 20}px`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;

        // dispatch custom event so parent can enter drag mode
        target.dispatchEvent(
          new CustomEvent("card-touch-drag-start", {
            bubbles: true,
            detail: { cardId: card.id },
          })
        );
      }, 300);
    },
    [card.id, isLocked]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!didLongPress.current) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    if (ghostRef.current) {
      ghostRef.current.style.left = `${touch.clientX - ghostRef.current.offsetWidth / 2}px`;
      ghostRef.current.style.top = `${touch.clientY - 20}px`;
    }
    // find slot under finger
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const slot = el?.closest("[data-slot-key]") as HTMLElement | null;
    // dispatch move event
    document.dispatchEvent(
      new CustomEvent("card-touch-drag-move", {
        detail: {
          cardId: card.id,
          slotKey: slot?.dataset.slotKey ?? null,
          x: touch.clientX,
          y: touch.clientY,
        },
      })
    );
  }, [card.id]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    if (didLongPress.current) {
      document.dispatchEvent(
        new CustomEvent("card-touch-drag-end", {
          detail: { cardId: card.id },
        })
      );
      didLongPress.current = false;
    }
  }, [card.id]);

  const handleClick = () => {
    if (didLongPress.current) return;
    if (!isPool && onToggleActions) {
      onToggleActions();
      return;
    }
    onTap?.();
  };

  return (
    <div
      draggable={!isLocked}
      onDragStart={(e) => {
        if (isLocked) {
          e.preventDefault();
          return;
        }
        onDragStart?.(e);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className="relative rounded-lg px-2.5 py-1.5 select-none transition-all"
      style={{
        background: isLocked ? cat.bg + "cc" : cat.bg,
        border: `1.5px solid ${cat.text}30`,
        borderLeft: isLocked ? `3px solid ${cat.text}` : undefined,
        cursor: isLocked ? "default" : "grab",
        opacity: isDimmed ? 0.35 : 1,
        outline: isActive ? `2px solid ${cat.text}` : "none",
        outlineOffset: isActive ? "1px" : undefined,
        minWidth: isPool ? "120px" : undefined,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{card.emoji}</span>
        <span
          className="text-xs font-medium truncate"
          style={{ color: cat.text, maxWidth: "110px" }}
        >
          {card.name}
        </span>
      </div>
      {card.description && (
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: cat.text + "99", maxWidth: "130px" }}
        >
          {card.description}
        </div>
      )}
      {card.tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {card.tags.map((t, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: t.bg, color: t.color }}
            >
              {t.label}
            </span>
          ))}
          {card.reservationStatus === "confirmed" && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "#d4f0e4", color: "#0f6e56" }}
            >
              예약완료
            </span>
          )}
          {card.reservationStatus === "pending" && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "#faeeda", color: "#854f0b" }}
            >
              예약대기
            </span>
          )}
        </div>
      )}

      {/* 액션 버튼 - 배치된 카드 */}
      {!isPool && showActions && (
        <div
          className="absolute -top-1 -right-1 flex gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {isLocked ? (
            <button
              onClick={onUnlock}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
              title="잠금 해제"
            >
              🔓
            </button>
          ) : (
            <button
              onClick={onLock}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
              title="고정"
            >
              🔒
            </button>
          )}
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
            title="제거"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
