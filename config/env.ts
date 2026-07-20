const configuredPublicApiUrl = process.env.NEXT_PUBLIC_SPINE_API_BASE_URL?.trim();

function withoutTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function withApiVersion(value: string) {
  const normalized = withoutTrailingSlash(value);
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
}

/**
 * Browser requests use the same-origin proxy unless a public API origin is
 * explicitly configured at build time and that origin permits browser CORS.
 */
export const SCREENING_API_BASE_URL = configuredPublicApiUrl
  ? withApiVersion(configuredPublicApiUrl)
  : "/spine-api";

export const SCREENING_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const SCREENING_REQUEST_TIMEOUT_MS = 120_000;

// The API also accepts BMP and TIFF, but JPEG/PNG are the reliable browser
// preview formats needed for a coordinate-accurate client overlay.
export const SCREENING_IMAGE_MIME_TYPES: string[] = ["image/jpeg", "image/png"];

export function getScreeningApiUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${SCREENING_API_BASE_URL}/${normalizedPath}`;
}
