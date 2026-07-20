import { getScreeningApiUrl } from "@/config/env";
import { ScreeningApiError, screeningErrorFromResponse } from "./errors";
import { isPredictionResponse, type PredictionResponse } from "./generated";

export interface CreatePredictionOptions {
  signal?: AbortSignal;
}

export async function createPrediction(
  file: File,
  { signal }: CreatePredictionOptions = {},
): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append("image", file, file.name);

  const response = await fetch(getScreeningApiUrl("predictions"), {
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

  if (!isPredictionResponse(payload)) {
    throw new ScreeningApiError({
      message: "The screening service response does not match the supported API contract.",
      status: 502,
      code: "api_contract_mismatch",
    });
  }

  return payload;
}
