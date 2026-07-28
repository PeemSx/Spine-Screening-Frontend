import type { ScreeningApiError } from "../api/errors";
import type { PredictionResponse } from "../api/generated";

export const MAX_PREDICTION_QUEUE_ITEMS = 20;

export type PredictionQueueStatus =
  | "queued"
  | "running"
  | "success"
  | "error";

export interface PredictionQueueItem {
  id: string;
  fingerprint: string;
  file: File;
  imageUrl: string;
  status: PredictionQueueStatus;
  result: PredictionResponse | null;
  error: ScreeningApiError | null;
  selectedCandidateId: number | null;
}

export interface PredictionQueueState {
  items: PredictionQueueItem[];
  selectedItemId: string | null;
  activeItemId: string | null;
  isProcessing: boolean;
}

export type PredictionFileRejectionCode =
  | "unsupported_type"
  | "file_too_large"
  | "duplicate"
  | "batch_limit";

export interface PredictionFileRejection {
  file: File;
  code: PredictionFileRejectionCode;
  message: string;
}

export interface AddFilesResult {
  added: PredictionQueueItem[];
  rejected: PredictionFileRejection[];
}

export interface PredictionQueueProgress {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  completed: number;
  percent: number;
}

/**
 * A browser-session fingerprint used to catch repeated selections without
 * hashing or reading the image itself.
 */
export function fingerprintPredictionFile(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

