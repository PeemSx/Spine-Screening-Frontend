import type { FastApiValidationError, ProblemDetail } from "./generated";

export class ScreeningApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor({
    message,
    status = 0,
    code = "screening_request_failed",
    requestId = null,
    retryAfterSeconds = null,
  }: {
    message: string;
    status?: number;
    code?: string;
    requestId?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(message);
    this.name = "ScreeningApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProblemDetail(value: unknown): value is ProblemDetail {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.status === "number" &&
    typeof value.detail === "string" &&
    typeof value.code === "string"
  );
}

function validationMessage(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.detail)) return null;
  const payload = value as unknown as FastApiValidationError;
  const messages = payload.detail
    .map((issue) => (typeof issue.msg === "string" ? issue.msg : null))
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? messages.join(" ") : null;
}

function parseRetryAfter(value: string | null) {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export async function screeningErrorFromResponse(response: Response) {
  const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (isProblemDetail(payload)) {
    return new ScreeningApiError({
      message: payload.detail,
      status: response.status,
      code: payload.code,
      requestId: payload.request_id ?? null,
      retryAfterSeconds,
    });
  }

  const fastApiMessage = validationMessage(payload);
  return new ScreeningApiError({
    message: fastApiMessage ?? `The screening request failed with status ${response.status}.`,
    status: response.status,
    code: response.status === 422 ? "request_validation_failed" : "screening_request_failed",
    retryAfterSeconds,
  });
}

export function normalizeScreeningError(error: unknown) {
  if (error instanceof ScreeningApiError) return error;
  if (error instanceof Error) {
    return new ScreeningApiError({ message: error.message, code: "network_error" });
  }
  return new ScreeningApiError({
    message: "An unexpected error occurred while contacting the screening service.",
  });
}
