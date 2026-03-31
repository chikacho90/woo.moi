"use client";
import type { Card, Placement, CardCategory } from "../types";
import { CATEGORY_COLORS } from "../types";
import PlannerCard from "./PlannerCard";

const ALL_CATEGORIES: ("all" | CardCategory)[] = ["all", "transport", "accommodation", "activity", "food", "chill", "errand"];

interface Props {
  cards: Card[];
  placements: Placement[];
  categoryFilter: string;
  activeCardId: string | null;
  mode: string;
  onCategoryChange: (cat: string) => void;
  onCardTap: (cardId: string) => void;
  onCardDragStart: (cardId: string, e: React.DragEvent) => void;
}

export default function CardPool({
  cards, placements, categoryFilter, activeCardId, mode,
  onCategoryChange, onCardTap, onCardDragStart,
}: Props) {
  const placedIds = new Set(placements.map(p => p.cardId));
  const poolCards = cards.filter(c => !placedIds.has(c.id));

  const filtered = categoryFilter === "all"
    ? poolCards
    : poolCards.filter(c => c.category === categoryFilter);

  // In slot-selecting mode, highlight only compatible cards
  const isSlotSelecting = mode === "slot-selecting";

  return (
    <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-4">
      {/* Category filter */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {ALL_CATEGORIES.map(cat => {
          const isAll = cat === "all";
          const catColor = isAll ? null : CATEGORY_COLORS[cat];
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0"
              style={
                isActive
                  ? {
                      backgroundColor: isAll ? "#1f2937" : catColor!.text,
                      color: "#fff",
                    }
                  : {
                      backgroundColor: isAll ? "#f3f4f6" : catColor!.bg,
                      color: isAll ? "#6b7280" : catColor!.text,
                    }
              }
            >
              {isAll ? "전체" : catColor!.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">
            {poolCards.length === 0
              ? "카드를 추가해서 일정을 채워보세요"
              : "이 카테고리에 카드가 없어요"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map(card => {
            const isActive = activeCardId === card.id;
            return (
              <PlannerCard
                key={card.id}
                card={card}
                isHighlighted={isActive}
                isDimmed={isSlotSelecting && !isActive}
                onTap={() => onCardTap(card.id)}
                onDragStart={e => onCardDragStart(card.id, e)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
