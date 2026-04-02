"use client";
import type { Card, TripDay, SlotType, Placement, Recommendation } from "../types";
import { getRecommendation, makeSlotKey, CATEGORY_COLORS } from "../types";
import PlannerCard from "./PlannerCard";

const REC_STYLES: Record<string, { border: string; bg: string; text: string; label: string }> = {
  idle:        { border: "1.5px dashed #ddd", bg: "transparent", text: "#bbb", label: "+" },
  compatible:  { border: "1.5px solid #85b717", bg: "#f4fae6", text: "#5a7a10", label: "가능" },
  recommended: { border: "1.5px solid #85b717", bg: "#eaf5d0", text: "#5a7a10", label: "여기" },
  ideal:       { border: "2px solid #c9a82c", bg: "#fffde6", text: "#8a7118", label: "추천!" },
  dragHover:   { border: "2px solid #0f6e56", bg: "#d4f0e4", text: "#0f6e56", label: "놓기!" },
  active:      { border: "2px solid #185fa5", bg: "#e6f1fb", text: "#185fa5", label: "선택중" },
};

interface Props {
  day: TripDay;
  slot: SlotType;
  cards: Card[];
  placements: Placement[];
  activeCardId: string | null;
  activeSlotKey: string | null;
  mode: string;
  dragOverSlot: string | null;
  onDragOver: (e?: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onSlotTap: () => void;
  onCardDragStart: (cardId: string, e: React.DragEvent) => void;
  onLock: (cardId: string) => void;
  onUnlock: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}

export default function SlotCell({
  day, slot, cards, placements, activeCardId, activeSlotKey, mode,
  dragOverSlot, onDragOver, onDragLeave, onDrop, onSlotTap,
  onCardDragStart, onLock, onUnlock, onRemove,
}: Props) {
  const slotKey = makeSlotKey(day.id, slot);
  const slotPlacements = placements
    .filter(p => p.slotKey === slotKey)
    .sort((a, b) => a.order - b.order);

  // Determine dropzone state
  let dropzoneState = "idle";
  const isDragHover = dragOverSlot === slotKey;
  const isActiveSlot = activeSlotKey === slotKey;

  if (isActiveSlot && mode === "slot-selecting") {
    dropzoneState = "active";
  } else if (activeCardId && (mode === "card-selecting" || mode === "dragging")) {
    const activeCard = cards.find(c => c.id === activeCardId);
    if (activeCard) {
      const rec = getRecommendation(activeCard, day, slot);
      if (isDragHover && rec !== "none") dropzoneState = "dragHover";
      else if (rec !== "none") dropzoneState = rec;
    }
  }

  const style = REC_STYLES[dropzoneState] || REC_STYLES.idle;

  return (
    <div
      className="min-h-[48px] flex flex-col gap-1 p-0.5"
      onDragOver={e => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Placed cards */}
      {slotPlacements.map(p => {
        const card = cards.find(c => c.id === p.cardId);
        if (!card) return null;
        return (
          <PlannerCard
            key={p.cardId}
            card={card}
            placement={p}
            compact
            onDragStart={e => onCardDragStart(p.cardId, e)}
            onLock={() => onLock(p.cardId)}
            onUnlock={() => onUnlock(p.cardId)}
            onRemove={() => onRemove(p.cardId)}
          />
        );
      })}

      {/* Dropzone */}
      <button
        onClick={onSlotTap}
        className={`w-full rounded-lg text-[10px] font-medium transition-all flex items-center justify-center ${
          slotPlacements.length > 0 ? "py-0.5 opacity-40 hover:opacity-100" : "py-2"
        }`}
        style={{
          border: style.border,
          backgroundColor: style.bg,
          color: style.text,
          fontWeight: dropzoneState === "ideal" || dropzoneState === "dragHover" ? 700 : 500,
        }}
      >
        {style.label}
      </button>
    </div>
  );
}
