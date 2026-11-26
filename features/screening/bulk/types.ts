import type { ScreeningApiError } from "../api/errors";
import type {
  LAPredictionResponse,
  PredictionResponse,
} from "../api/contract";

export const MAX_PREDICTION_QUEUE_ITEMS = 20;

export type PredictionQueueStatus =
  | "queued"
  | "running"
  | "success"
  | "error";

export type PredictionQueueResult =
  | PredictionResponse
  | LAPredictionResponse;

export interface PredictionQueueItem<
  Result extends PredictionQueueResult = PredictionResponse,
> {
  id: string;
  fingerprint: string;
  file: File;
  status: PredictionQueueStatus;
  result: Result | null;
  error: ScreeningApiError | null;
  selectedCandidateId: number | null;
}

export interface PredictionQueueState<
  Result extends PredictionQueueResult = PredictionResponse,
> {
  items: PredictionQueueItem<Result>[];
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

export interface AddFilesResult<
  Result extends PredictionQueueResult = PredictionResponse,
> {
  added: PredictionQueueItem<Result>[];
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
