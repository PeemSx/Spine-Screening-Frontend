import { getScreeningApiUrl } from "@/config/env";
import { ScreeningApiError, screeningErrorFromResponse } from "./errors";
import {
  isLAPredictionResponse,
  isPredictionResponse,
  type LAPredictionResponse,
  type PredictionResponse,
} from "./contract";

export interface CreatePredictionOptions {
  signal?: AbortSignal;
}

async function postPrediction<Response>(
  path: string,
  file: File,
  isResponse: (value: unknown) => value is Response,
  { signal }: CreatePredictionOptions = {},
): Promise<Response> {
  const formData = new FormData();
  formData.append("image", file, file.name);

  const response = await fetch(getScreeningApiUrl(path), {
    method: "POST",
    headers: { Accept: "application/json, application/problem+json" },
    body: formData,
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await screeningErrorFromResponse(response);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ScreeningApiError({
      message: "The screening service returned an unreadable response.",
      status: 502,
      code: "invalid_api_response",
    });
  }

  if (!isResponse(payload)) {
    throw new ScreeningApiError({
      message: "The screening service response does not match the supported API contract.",
      status: 502,
      code: "api_contract_mismatch",
    });
  }

  return payload;
}

export function createPrediction(
  file: File,
  options: CreatePredictionOptions = {},
): Promise<PredictionResponse> {
  return postPrediction("predictions", file, isPredictionResponse, options);
}

export function createLAPrediction(
  file: File,
  options: CreatePredictionOptions = {},
): Promise<LAPredictionResponse> {
  return postPrediction(
    "la/predictions",
    file,
    isLAPredictionResponse,
    options,
  );
}
