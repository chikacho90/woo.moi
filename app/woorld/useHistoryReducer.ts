import { useReducer, useCallback, useMemo } from "react";
import type { PlannerState } from "./types";
import type { PlannerAction } from "./reducer";
import { plannerReducer } from "./reducer";

const MAX_HISTORY = 20;

const NON_UNDOABLE = new Set<PlannerAction["type"]>([
  "LOAD",
  "SET_UI",
  "RESET",
]);

interface History {
  past: PlannerState[];
  present: PlannerState;
  future: PlannerState[];
}

type HistoryAction =
  | PlannerAction
  | { type: "__UNDO__" }
  | { type: "__REDO__" };

function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "__UNDO__") {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    return {
      past: newPast,
      present: previous,
      future: [state.present, ...state.future].slice(0, MAX_HISTORY),
    };
  }
  if (action.type === "__REDO__") {
    if (state.future.length === 0) return state;
    const [next, ...rest] = state.future;
    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY),
      present: next,
      future: rest,
    };
  }

  const next = plannerReducer(state.present, action);
  if (next === state.present) return state;

  if (NON_UNDOABLE.has(action.type)) {
    return { ...state, present: next };
  }

  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
  };
}

export function useHistoryReducer(initial: PlannerState) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
  });

  const undo = useCallback(() => dispatch({ type: "__UNDO__" }), []);
  const redo = useCallback(() => dispatch({ type: "__REDO__" }), []);

  const meta = useMemo(
    () => ({
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [undo, redo, history.past.length, history.future.length]
  );

  return [history.present, dispatch as React.Dispatch<PlannerAction>, meta] as const;
}
