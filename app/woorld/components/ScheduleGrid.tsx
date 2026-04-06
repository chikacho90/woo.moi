"use client";
import { useState, useCallback, useEffect, Fragment } from "react";
import type { PlannerState, SlotType, Recommendation, Card, TripDay } from "../types";
import { SLOT_TYPES, CATEGORY_COLORS, makeSlotKey, parseSlotKey } from "../types";
import { getRecommendation, isCompatible } from "../reducer";
import type { PlannerAction } from "../reducer";
import CardChip from "./CardChip";

interface Props {
  state: PlannerState;
  dispatch: React.Dispatch<PlannerAction>;
  onAddDay?: () => void;
}

const SLOT_STYLES: Record<
  string,
  { border: string; bg: string; text: string; textColor: string; fontWeight?: number }
> = {
  idle: { border: "1.5px dashed rgba(255,255,255,0.1)", bg: "transparent", text: "+", textColor: "rgba(255,255,255,0.15)" },
  compatible: { border: "1.5px solid rgba(133,183,23,0.5)", bg: "rgba(133,183,23,0.08)", text: "가능", textColor: "#85b717" },
  recommended: { border: "1.5px solid rgba(133,183,23,0.7)", bg: "rgba(133,183,23,0.12)", text: "여기", textColor: "#a0d020" },
  ideal: {
    border: "2px solid rgba(201,168,44,0.7)",
    bg: "rgba(201,168,44,0.1)",
    text: "추천!",
    textColor: "#e0c040",
    fontWeight: 700,
  },
  "drag-hover": {
    border: "2px solid rgba(15,110,86,0.8)",
    bg: "rgba(15,110,86,0.15)",
    text: "놓기!",
    textColor: "#3dd9a0",
    fontWeight: 700,
  },
  active: { border: "2px solid rgba(24,95,165,0.7)", bg: "rgba(24,95,165,0.12)", text: "선택중", textColor: "#7eb8f0" },
};

export default function ScheduleGrid({ state, dispatch, onAddDay }: Props) {
  const { days, cards, placements, ui } = state;
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<string | null>(null);
  const [touchDragCard, setTouchDragCard] = useState<string | null>(null);
  const [touchHoverSlot, setTouchHoverSlot] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editArea, setEditArea] = useState("");

  // Listen for touch drag events from CardChip
  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setTouchDragCard(detail.cardId);
      dispatch({ type: "SET_UI", ui: { mode: "dragging", activeCardId: detail.cardId } });
    };
    const onMove = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setTouchHoverSlot(detail.slotKey);
    };
    const onEnd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (touchHoverSlot && touchDragCard) {
        const card = cards.find((c) => c.id === touchDragCard);
        const { dayId, slot } = parseSlotKey(touchHoverSlot);
        const day = days.find((d) => d.id === dayId);
        if (card && day && isCompatible(card, day, slot)) {
          const existing = placements.find((p) => p.cardId === touchDragCard);
          dispatch({
            type: existing ? "MOVE_CARD" : "PLACE_CARD",
            cardId: touchDragCard,
            slotKey: touchHoverSlot,
          });
        }
      }
      setTouchDragCard(null);
      setTouchHoverSlot(null);
      dispatch({ type: "SET_UI", ui: { mode: "idle", activeCardId: null } });
    };

    document.addEventListener("card-touch-drag-start", onStart);
    document.addEventListener("card-touch-drag-move", onMove);
    document.addEventListener("card-touch-drag-end", onEnd);
    return () => {
      document.removeEventListener("card-touch-drag-start", onStart);
      document.removeEventListener("card-touch-drag-move", onMove);
      document.removeEventListener("card-touch-drag-end", onEnd);
    };
  }, [touchHoverSlot, touchDragCard, cards, days, placements, dispatch]);

  const activeCard = ui.activeCardId
    ? cards.find((c) => c.id === ui.activeCardId) ?? null
    : null;

  const getSlotVisual = useCallback(
    (dayId: string, slot: SlotType): keyof typeof SLOT_STYLES => {
      const day = days.find((d) => d.id === dayId);
      if (!day || !activeCard) return "idle";

      // touch drag hover
      const slotKey = makeSlotKey(dayId, slot);
      if (
        (ui.mode === "dragging" || touchDragCard) &&
        (hoverSlot === slotKey || touchHoverSlot === slotKey)
      ) {
        if (isCompatible(activeCard, day, slot)) return "drag-hover";
      }

      // tap mode: slot selected
      if (ui.mode === "slot-selecting" && ui.activeSlotKey === slotKey) {
        return "active";
      }

      // show recommendations
      if (ui.mode === "dragging" || ui.mode === "card-selecting" || touchDragCard) {
        const rec = getRecommendation(activeCard, day, slot);
        if (rec !== "none") return rec;
      }

      return "idle";
    },
    [days, activeCard, ui, hoverSlot, touchDragCard, touchHoverSlot]
  );

  const handleDragOver = (e: React.DragEvent, dayId: string, slot: SlotType) => {
    const day = days.find((d) => d.id === dayId);
    if (!activeCard || !day || !isCompatible(activeCard, day, slot)) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverSlot(makeSlotKey(dayId, slot));
  };

  const handleDrop = (e: React.DragEvent, dayId: string, slot: SlotType) => {
    e.preventDefault();
    setHoverSlot(null);
    if (!ui.activeCardId) return;
    const slotKey = makeSlotKey(dayId, slot);
    const existing = placements.find((p) => p.cardId === ui.activeCardId);
    dispatch({
      type: existing ? "MOVE_CARD" : "PLACE_CARD",
      cardId: ui.activeCardId!,
      slotKey,
    });
  };

  const handleSlotTap = (dayId: string, slot: SlotType) => {
    const slotKey = makeSlotKey(dayId, slot);

    // If in card-selecting mode, place the card
    if (ui.mode === "card-selecting" && ui.activeCardId) {
      const day = days.find((d) => d.id === dayId);
      const card = cards.find((c) => c.id === ui.activeCardId);
      if (card && day && isCompatible(card, day, slot)) {
        const existing = placements.find((p) => p.cardId === ui.activeCardId);
        dispatch({
          type: existing ? "MOVE_CARD" : "PLACE_CARD",
          cardId: ui.activeCardId!,
          slotKey,
        });
      }
      return;
    }

    // Otherwise start slot-selecting mode
    if (ui.mode === "slot-selecting" && ui.activeSlotKey === slotKey) {
      dispatch({ type: "SET_UI", ui: { mode: "idle", activeSlotKey: null } });
      return;
    }
    dispatch({
      type: "SET_UI",
      ui: { mode: "slot-selecting", activeSlotKey: slotKey, activeCardId: null },
    });
  };

  const handleDragStartCard = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardId);
    dispatch({ type: "SET_UI", ui: { mode: "dragging", activeCardId: cardId } });
  };

  const handleDragEnd = () => {
    setHoverSlot(null);
    dispatch({ type: "SET_UI", ui: { mode: "idle", activeCardId: null } });
  };

  const handleRemoveDay = (dayId: string) => {
    dispatch({ type: "REMOVE_DAY", dayId });
  };

  if (days.length === 0) {
    return (
      <button
        onClick={onAddDay}
        className="w-full flex items-center justify-center py-20 rounded-xl border-2 border-dashed transition-colors hover:border-white/20 hover:bg-white/[0.02] cursor-pointer"
        style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
      >
        <div className="text-center">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-sm">날짜를 추가해서 시작하세요</div>
        </div>
      </button>
    );
  }

  return (
    <div
      className="overflow-x-auto pb-2"
      onDragEnd={handleDragEnd}
      style={{
        WebkitOverflowScrolling: "touch",
        scrollSnapType: "x proximity",
        scrollbarWidth: "none",
      }}
    >
      <style>{`.schedule-grid-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="grid gap-0 schedule-grid-scroll"
        style={{
          gridTemplateColumns: `48px repeat(${days.length}, minmax(140px, 1fr)) 48px`,
          minWidth: `${48 + days.length * 140 + 48}px`,
        }}
      >
        {/* Header row */}
        <div className="h-auto" />
        {days.map((day) => (
          <div
            key={day.id}
            className="rounded-t-lg mx-0.5 px-2 py-1.5"
            style={{ background: day.color + "18", scrollSnapAlign: "start" }}
          >
            {editingDay === day.id ? (
              /* ── 인라인 편집 모드 ── */
              <div className="space-y-1">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      dispatch({
                        type: "UPDATE_DAY",
                        dayId: day.id,
                        updates: { label: editLabel || day.label, area: editArea },
                      });
                      setEditingDay(null);
                    } else if (e.key === "Escape") {
                      setEditingDay(null);
                    }
                  }}
                  className="w-full text-xs font-semibold bg-white/80 rounded px-1.5 py-0.5 outline-none"
                  style={{ color: day.color, borderBottom: `2px solid ${day.color}` }}
                />
                <div className="flex gap-1 flex-wrap">
                  {["any", ...(state.trip?.areas ?? []).filter((a: string) => a !== "any")].map((a) => (
                    <button
                      key={a}
                      onClick={() => setEditArea(a)}
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: editArea === a ? day.color : "transparent",
                        color: editArea === a ? "#fff" : day.color,
                        border: `1px solid ${day.color}40`,
                      }}
                    >
                      {a === "any" ? "어디든" : a}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      dispatch({
                        type: "UPDATE_DAY",
                        dayId: day.id,
                        updates: { label: editLabel || day.label, area: editArea },
                      });
                      setEditingDay(null);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded font-medium"
                    style={{ background: day.color, color: "#fff" }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingDay(null)}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{ color: day.color }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              /* ── 보기 모드 ── */
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    setEditingDay(day.id);
                    setEditLabel(day.label);
                    setEditArea(day.area);
                  }}
                  title="클릭하여 편집"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: day.color }}
                  />
                  <span
                    className="text-xs font-semibold truncate"
                    style={{ color: day.color }}
                  >
                    {day.label}
                  </span>
                  {day.area !== "any" && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: day.color + "15", color: day.color }}
                    >
                      {day.area}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveDay(day.id)}
                  className="text-xs opacity-40 hover:opacity-100 flex-shrink-0 ml-1"
                  style={{ color: day.color }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add day button (last header column) */}
        <button
          onClick={onAddDay}
          className="flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.04]"
          style={{ color: "rgba(255,255,255,0.2)" }}
          title="날짜 추가"
        >
          <span className="text-lg">+</span>
        </button>

        {/* Slot rows */}
        {SLOT_TYPES.map((slot) => (
          <Fragment key={slot}>
            {/* Slot label */}
            <div
              className="flex items-start justify-center pt-3 text-xs font-medium"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {slot}
            </div>

            {/* Day cells */}
            {days.map((day) => {
              const slotKey = makeSlotKey(day.id, slot);
              const cellPlacements = placements
                .filter((p) => p.slotKey === slotKey)
                .sort((a, b) => a.order - b.order);
              const visual = getSlotVisual(day.id, slot);
              const style = SLOT_STYLES[visual];

              return (
                <div
                  key={slotKey}
                  data-slot-key={slotKey}
                  className="min-h-[60px] rounded-lg mx-0.5 mb-0.5 p-1 flex flex-col gap-1 transition-colors"
                  style={{
                    border: style.border,
                    background: style.bg,
                  }}
                  onDragOver={(e) => handleDragOver(e, day.id, slot)}
                  onDragLeave={() => setHoverSlot(null)}
                  onDrop={(e) => handleDrop(e, day.id, slot)}
                >
                  {/* Placed cards */}
                  {cellPlacements.map((p) => {
                    const card = cards.find((c) => c.id === p.cardId);
                    if (!card) return null;
                    return (
                      <CardChip
                        key={p.cardId}
                        card={card}
                        placement={p}
                        showActions={activeActions === p.cardId}
                        onToggleActions={() =>
                          setActiveActions(
                            activeActions === p.cardId ? null : p.cardId
                          )
                        }
                        onDragStart={(e) => handleDragStartCard(e, card.id)}
                        onLock={() => dispatch({ type: "LOCK_CARD", cardId: card.id })}
                        onUnlock={() => dispatch({ type: "UNLOCK_CARD", cardId: card.id })}
                        onRemove={() => {
                          dispatch({ type: "UNPLACE_CARD", cardId: card.id });
                          setActiveActions(null);
                        }}
                      />
                    );
                  })}

                  {/* Drop zone / tap zone */}
                  <button
                    className="w-full py-1 rounded text-xs transition-colors flex-shrink-0"
                    style={{
                      color: style.textColor,
                      fontWeight: style.fontWeight ?? 400,
                    }}
                    onClick={() => handleSlotTap(day.id, slot)}
                  >
                    {style.text}
                  </button>
                </div>
              );
            })}
            {/* Spacer for add-day column */}
            <div />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
