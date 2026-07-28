import type {
  PredictionQueueItem,
  PredictionQueueState,
} from "./types";
import type { ScreeningApiError } from "../api/errors";
import type { PredictionResponse } from "../api/generated";

export const initialPredictionQueueState: PredictionQueueState = {
  items: [],
  selectedItemId: null,
  activeItemId: null,
  isProcessing: false,
};

export type PredictionQueueAction =
  | { type: "add"; items: PredictionQueueItem[] }
  | { type: "remove"; itemId: string }
  | { type: "select"; itemId: string }
  | {
      type: "select_candidate";
      itemId: string;
      candidateId: number | null;
    }
  | { type: "start_processing" }
  | { type: "start_item"; itemId: string }
  | {
      type: "complete_item";
      itemId: string;
      result: PredictionResponse;
    }
  | { type: "fail_item"; itemId: string; error: ScreeningApiError }
  | { type: "retry_failed" }
  | { type: "stop_processing" }
  | { type: "finish_processing" }
  | { type: "clear" };

function replaceItem(
  state: PredictionQueueState,
  itemId: string,
  update: (item: PredictionQueueItem) => PredictionQueueItem,
) {
  let changed = false;
  const items = state.items.map((item) => {
    if (item.id !== itemId) return item;
    changed = true;
    return update(item);
  });
  return changed ? items : state.items;
}

function selectedIdAfterRemoval(
  state: PredictionQueueState,
  removedIndex: number,
) {
  if (state.selectedItemId !== state.items[removedIndex]?.id) {
    return state.selectedItemId;
  }

  const nextItem = state.items[removedIndex + 1];
  const previousItem = state.items[removedIndex - 1];
  return nextItem?.id ?? previousItem?.id ?? null;
}

export function predictionQueueReducer(
  state: PredictionQueueState,
  action: PredictionQueueAction,
): PredictionQueueState {
  switch (action.type) {
    case "add": {
      if (action.items.length === 0) return state;
      return {
        ...state,
        items: [...state.items, ...action.items],
        // An add is an explicit review action, so open the newest accepted case.
        // Prediction completion still never changes the selected case.
        selectedItemId: action.items[action.items.length - 1].id,
      };
    }

    case "remove": {
      const removedIndex = state.items.findIndex(
        (item) => item.id === action.itemId,
      );
      if (
        removedIndex < 0 ||
        state.items[removedIndex].status === "running"
      ) {
        return state;
      }
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.itemId),
        selectedItemId: selectedIdAfterRemoval(state, removedIndex),
      };
    }

    case "select":
      return state.items.some((item) => item.id === action.itemId)
        ? { ...state, selectedItemId: action.itemId }
        : state;

    case "select_candidate": {
      const items = replaceItem(state, action.itemId, (item) => ({
        ...item,
        selectedCandidateId: action.candidateId,
      }));
      return items === state.items ? state : { ...state, items };
    }

    case "start_processing":
      return state.isProcessing ? state : { ...state, isProcessing: true };

    case "start_item": {
      const item = state.items.find(({ id }) => id === action.itemId);
      if (!state.isProcessing || item?.status !== "queued") return state;
      const items = replaceItem(state, action.itemId, (queueItem) => ({
        ...queueItem,
        status: "running",
        result: null,
        error: null,
      }));
      return {
        ...state,
        items,
        activeItemId: action.itemId,
      };
    }

    case "complete_item": {
      const item = state.items.find(({ id }) => id === action.itemId);
      if (item?.status !== "running") return state;
      const items = replaceItem(state, action.itemId, (queueItem) => ({
        ...queueItem,
        status: "success",
        result: action.result,
        error: null,
        selectedCandidateId:
          queueItem.selectedCandidateId ??
          action.result.morphology[0]?.candidate_id ??
          action.result.selected_vertebrae[0]?.candidate_id ??
          null,
      }));
      return {
        ...state,
        items,
        activeItemId:
          state.activeItemId === action.itemId ? null : state.activeItemId,
      };
    }

    case "fail_item": {
      const item = state.items.find(({ id }) => id === action.itemId);
      if (item?.status !== "running") return state;
      const items = replaceItem(state, action.itemId, (queueItem) => ({
        ...queueItem,
        status: "error",
        result: null,
        error: action.error,
      }));
      return {
        ...state,
        items,
        activeItemId:
          state.activeItemId === action.itemId ? null : state.activeItemId,
      };
    }

    case "retry_failed": {
      const items = state.items.map((item) =>
        item.status === "error"
          ? {
              ...item,
              status: "queued" as const,
              result: null,
              error: null,
            }
          : item,
      );
      return items.some((item, index) => item !== state.items[index])
        ? { ...state, items }
        : state;
    }

    case "stop_processing": {
      const items = state.items.map((item) =>
        item.status === "running"
          ? {
              ...item,
              status: "queued" as const,
              result: null,
              error: null,
            }
          : item,
      );
      return {
        ...state,
        items,
        activeItemId: null,
        isProcessing: false,
      };
    }

    case "finish_processing": {
      if (!state.isProcessing && state.activeItemId === null) return state;
      return {
        ...state,
        activeItemId: null,
        isProcessing: false,
      };
    }

    case "clear":
      return initialPredictionQueueState;
  }
}
