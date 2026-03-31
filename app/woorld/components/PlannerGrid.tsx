"use client";
import type { PlannerState } from "../types";
import { SLOT_TYPES, makeSlotKey, isCompatible } from "../types";
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
      // Card was selected, now place it
      const card = cards.find(c => c.id === ui.activeCardId);
      const day = days.find(d => d.id === dayId);
      if (card && day && isCompatible(card, day, slot)) {
        dispatch({ type: "PLACE_CARD", payload: { cardId: ui.activeCardId, slotKey } });
      }
    } else {
      // Slot-first: select this slot, wait for card
      dispatch({ type: "SET_UI_MODE", payload: { mode: "slot-selecting", activeSlotKey: slotKey } });
    }
  };

  return (
    <div className="overflow-x-auto">
      {days.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-sm text-gray-400 mb-1">날짜를 추가해서 시작하세요</p>
          <p className="text-xs text-gray-300">헤더의 + 버튼을 눌러 여행 일정을 만들어보세요</p>
        </div>
      ) : (
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="w-16 p-2" />
              {days.map(day => (
                <th key={day.id} className="p-2 min-w-[160px]">
                  <div
                    className="rounded-xl px-3 py-2 text-center cursor-pointer hover:opacity-80 transition-opacity relative group"
                    style={{ backgroundColor: `${day.color}15`, borderBottom: `3px solid ${day.color}` }}
                    onClick={() => onEditDay(day.id)}
                  >
                    <p className="text-sm font-bold" style={{ color: day.color }}>{day.label}</p>
                    {day.date && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{day.date}</p>
                    )}
                    {day.area !== "any" && (
                      <p className="text-[10px] mt-0.5" style={{ color: `${day.color}99` }}>{day.area}</p>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); dispatch({ type: "REMOVE_DAY", payload: { id: day.id } }); }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow border border-gray-200 text-[10px] text-gray-400 hover:text-red-500 hidden group-hover:flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOT_TYPES.map(slot => (
              <tr key={slot} className="border-t border-gray-100">
                <td className="p-2 text-center">
                  <span className="text-[11px] font-medium text-gray-400">{slot}</span>
                </td>
                {days.map(day => {
                  const slotKey = makeSlotKey(day.id, slot);
                  return (
                    <td key={slotKey} className="p-1 align-top border-l border-gray-100">
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
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
