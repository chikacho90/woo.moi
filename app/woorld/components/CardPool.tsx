"use client";
import type { PlannerState, CardCategory, SlotType } from "../types";
import { CATEGORY_COLORS, parseSlotKey } from "../types";
import { isCompatible } from "../reducer";
import type { PlannerAction } from "../reducer";
import CardChip from "./CardChip";

interface Props {
  state: PlannerState;
  dispatch: React.Dispatch<PlannerAction>;
  onAddCard?: () => void;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "transport", label: "교통" },
  { key: "accommodation", label: "숙소" },
  { key: "activity", label: "액티비티" },
  { key: "food", label: "식사" },
  { key: "chill", label: "힐링" },
  { key: "errand", label: "기타" },
];

export default function CardPool({ state, dispatch, onAddCard }: Props) {
  const { cards, placements, ui, days } = state;
  const placedIds = new Set(placements.map((p) => p.cardId));
  const poolCards = cards.filter((c) => !placedIds.has(c.id));

  const filtered =
    ui.categoryFilter === "all"
      ? poolCards
      : poolCards.filter((c) => c.category === ui.categoryFilter);

  // Determine dimming for slot-selecting mode
  const isDimmed = (cardId: string): boolean => {
    if (ui.mode !== "slot-selecting" || !ui.activeSlotKey) return false;
    const { dayId, slot } = parseSlotKey(ui.activeSlotKey);
    const day = days.find((d) => d.id === dayId);
    const card = cards.find((c) => c.id === cardId);
    if (!day || !card) return true;
    return !isCompatible(card, day, slot);
  };

  const handleCardTap = (cardId: string) => {
    // If in slot-selecting mode, place the card
    if (ui.mode === "slot-selecting" && ui.activeSlotKey) {
      const [dayId, ...slotParts] = ui.activeSlotKey.split("-");
      const slot = slotParts.join("-") as SlotType;
      const day = days.find((d) => d.id === dayId);
      const card = cards.find((c) => c.id === cardId);
      if (card && day && isCompatible(card, day, slot)) {
        dispatch({ type: "PLACE_CARD", cardId, slotKey: ui.activeSlotKey });
      }
      return;
    }

    // Otherwise toggle card-selecting mode
    if (ui.mode === "card-selecting" && ui.activeCardId === cardId) {
      dispatch({ type: "SET_UI", ui: { mode: "idle", activeCardId: null } });
      return;
    }
    dispatch({
      type: "SET_UI",
      ui: { mode: "card-selecting", activeCardId: cardId, activeSlotKey: null },
    });
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardId);
    dispatch({ type: "SET_UI", ui: { mode: "dragging", activeCardId: cardId } });
  };

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = ui.categoryFilter === f.key;
          const cat =
            f.key !== "all"
              ? CATEGORY_COLORS[f.key as CardCategory]
              : null;
          return (
            <button
              key={f.key}
              onClick={() =>
                dispatch({
                  type: "SET_UI",
                  ui: { categoryFilter: f.key },
                })
              }
              className="px-3 py-1 rounded-full text-xs whitespace-nowrap border transition-colors"
              style={{
                background: active
                  ? cat?.bg ?? "rgba(255,255,255,0.12)"
                  : "transparent",
                color: active
                  ? cat?.text ?? "#fff"
                  : "rgba(255,255,255,0.4)",
                borderColor: active
                  ? (cat?.text ?? "#fff") + "40"
                  : "rgba(255,255,255,0.1)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <button
          onClick={onAddCard}
          className="w-full flex items-center justify-center py-8 rounded-xl border-2 border-dashed transition-colors hover:border-white/20 hover:bg-white/[0.02] cursor-pointer"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}
        >
          <div className="text-center">
            <div className="text-2xl mb-1">🃏</div>
            <div className="text-xs">
              {poolCards.length === 0
                ? "카드를 추가해서 일정을 채워보세요"
                : "이 카테고리에 카드가 없습니다"}
            </div>
          </div>
        </button>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filtered.map((card) => (
            <div key={card.id} className="flex-shrink-0 relative group">
              <CardChip
                card={card}
                isPool
                isActive={ui.mode === "card-selecting" && ui.activeCardId === card.id}
                isDimmed={isDimmed(card.id)}
                onTap={() => handleCardTap(card.id)}
                onDragStart={(e) => handleDragStart(e, card.id)}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "REMOVE_CARD", cardId: card.id });
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", color: "#999" }}
                title="카드 삭제"
              >
                ✕
              </button>
            </div>
          ))}
          {/* Add card button */}
          <button
            onClick={onAddCard}
            className="flex-shrink-0 w-[100px] h-[60px] rounded-xl border-2 border-dashed flex items-center justify-center transition-colors hover:border-white/20 hover:bg-white/[0.02]"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.2)" }}
            title="카드 추가"
          >
            <span className="text-lg">+</span>
          </button>
        </div>
      )}
    </div>
  );
}
