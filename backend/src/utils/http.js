/* ============================================================================
 * SkyCast backend — src/utils/http.js
 * ----------------------------------------------------------------------------
 * Shared upstream HTTP helper.
 *   • fetchJson  — timeout via AbortController; parses JSON; non-2xx throws
 *                  a plain Error carrying `.status` for the caller to map.
 *   • toAppError — maps an upstream status to the contract's AppError codes
 *                  (404→CITY_NOT_FOUND, 401/403→UPSTREAM_CONFIG,
 *                   429→RATE_LIMITED, 5xx→UPSTREAM_DOWN).
 * Raw upstream error bodies are never forwarded — only codes + safe messages.
 * ========================================================================== */
import { AppError } from "./errors.js";

export const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new AppError(504, "UPSTREAM_TIMEOUT", `Upstream request timed out after ${timeoutMs} ms.`, { cause: err });
    }
    throw new AppError(502, "UPSTREAM_DOWN", "Could not reach the upstream weather service.", { cause: err });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const err = new Error(`Upstream responded with HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  try {
    return await response.json();
  } catch (err) {
    throw new AppError(502, "UPSTREAM_DOWN", "Upstream returned a malformed response.", { cause: err });
  }
}

/** Map an upstream HTTP status to the stable, frontend-facing error codes. */
export function toAppError(status, { provider = "upstream", city = "" } = {}) {
  switch (status) {
    case 404:
      return new AppError(404, "CITY_NOT_FOUND",
        city
          ? `We couldn't find “${city}”. Double-check the spelling and try again.`
          : "We couldn't find that location. Double-check and try again.");
    case 401:
    case 403:
      return new AppError(502, "UPSTREAM_CONFIG",
        `The ${provider} credentials are missing or invalid (server configuration issue).`);
    case 429:
      return new AppError(503, "RATE_LIMITED",
        "The weather service is rate-limited right now. Please retry shortly.");
    default:
      return new AppError(502, "UPSTREAM_DOWN",
        `The ${provider} service is having trouble (HTTP ${status}). Please retry shortly.`);
  }
}
