"use client";
import { useState } from "react";
import type { PlannerState } from "../types";
import { SLOT_TYPES, makeSlotKey, isCompatible, formatDate } from "../types";
import SlotCell from "./SlotCell";
import type { PlannerAction } from "../reducer";

interface Props {
  state: PlannerState;
  dispatch: React.Dispatch<PlannerAction>;
  dragCardId: string | null;
  dragOverSlot: string | null;
  setDragCardId: (id: string | null) => void;
  setDragOverSlot: (key: string | null) => void;
  onEditDay: (dayId: string) => void;
}

export default function PlannerGrid({
  state, dispatch, dragCardId, dragOverSlot,
  setDragCardId, setDragOverSlot, onEditDay,
}: Props) {
  const { days, cards, placements, ui } = state;
  const [deleteDayId, setDeleteDayId] = useState<string | null>(null);

  const handleCardDragStart = (cardId: string, e: React.DragEvent) => {
    const p = placements.find(p => p.cardId === cardId);
    if (p?.status === "locked") { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
    setDragCardId(cardId);
    dispatch({ type: "SET_UI_MODE", payload: { mode: "dragging", activeCardId: cardId } });
  };

  const handleSlotTap = (dayId: string, slot: typeof SLOT_TYPES[number]) => {
    const slotKey = makeSlotKey(dayId, slot);
    if (ui.mode === "card-selecting" && ui.activeCardId) {
      const card = cards.find(c => c.id === ui.activeCardId);
      const day = days.find(d => d.id === dayId);
      if (card && day && isCompatible(card, day, slot)) {
        dispatch({ type: "PLACE_CARD", payload: { cardId: ui.activeCardId, slotKey } });
      }
    } else {
      dispatch({ type: "SET_UI_MODE", payload: { mode: "slot-selecting", activeSlotKey: slotKey } });
    }
  };

  if (days.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🧩</span>
        </div>
        <p className="text-sm text-gray-400 mb-1">퍼즐판이 비어있어요</p>
        <p className="text-xs text-gray-300">여행 기간을 설정하면 퍼즐판이 만들어져요</p>
      </div>
    );
  }

  const colCount = days.length;

  return (
    <>
      <div
        className="grid gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100"
        style={{ gridTemplateColumns: `44px repeat(${colCount}, 1fr)` }}
      >
        {/* Header: corner + day headers */}
        <div className="bg-[#fafaf8]" />
        {days.map(day => (
          <div
            key={day.id}
            className="bg-white px-1 py-2 text-center cursor-pointer hover:bg-gray-50 transition-colors relative group"
            onClick={() => onEditDay(day.id)}
          >
            <p className="text-[11px] font-bold truncate" style={{ color: day.color }}>{day.label}</p>
            {day.date && (
              <p className="text-[9px] text-gray-300 mt-0.5">{formatDate(day.date)}</p>
            )}
            {day.area !== "any" && (
              <p className="text-[9px] truncate" style={{ color: `${day.color}88` }}>{day.area}</p>
            )}
            <button
              onClick={e => { e.stopPropagation(); setDeleteDayId(day.id); }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white shadow-sm border border-gray-200 text-[8px] text-gray-400 hover:text-red-500 hidden group-hover:flex items-center justify-center z-10"
              aria-label={`${day.label} 삭제`}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Slot rows */}
        {SLOT_TYPES.map(slot => (
          <div key={slot} className="contents">
            {/* Slot label */}
            <div className="bg-[#fafaf8] flex items-center justify-center">
              <span className="text-[10px] font-semibold text-gray-300">{slot}</span>
            </div>

            {/* Cells */}
            {days.map(day => {
              const slotKey = makeSlotKey(day.id, slot);
              return (
                <div key={slotKey} className="bg-white">
                  <SlotCell
                    day={day}
                    slot={slot}
                    cards={cards}
                    placements={placements}
                    activeCardId={ui.activeCardId}
                    activeSlotKey={ui.activeSlotKey}
                    mode={ui.mode}
                    dragOverSlot={dragOverSlot}
                    onDragOver={() => setDragOverSlot(slotKey)}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={e => {
                      e.preventDefault();
                      const cardId = e.dataTransfer.getData("text/plain") || dragCardId;
                      if (!cardId) return;
                      const card = cards.find(c => c.id === cardId);
                      const d = days.find(d2 => d2.id === day.id);
                      if (card && d && isCompatible(card, d, slot)) {
                        dispatch({ type: "PLACE_CARD", payload: { cardId, slotKey } });
                      }
                      setDragCardId(null);
                      setDragOverSlot(null);
                    }}
                    onSlotTap={() => handleSlotTap(day.id, slot)}
                    onCardDragStart={handleCardDragStart}
                    onLock={id => dispatch({ type: "LOCK_CARD", payload: { cardId: id } })}
                    onUnlock={id => dispatch({ type: "UNLOCK_CARD", payload: { cardId: id } })}
                    onRemove={id => dispatch({ type: "UNPLACE_CARD", payload: { cardId: id } })}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Delete day confirm */}
      {deleteDayId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteDayId(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />
          <div onClick={e => e.stopPropagation()} className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 animate-modalIn">
            <p className="text-sm text-gray-700 text-center mb-5 leading-relaxed">이 날짜를 삭제할까요?<br/>배치된 카드도 풀에 돌아갑니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteDayId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={() => { dispatch({ type: "REMOVE_DAY", payload: { id: deleteDayId } }); setDeleteDayId(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
