/* ============================================================================
 * SkyCast frontend — js/api/client.js
 * ----------------------------------------------------------------------------
 * ★ THE ONLY module in the entire frontend allowed to talk to a server. ★
 * Every request is a same-origin call to OUR backend (/api/v1/*) — never to
 * a weather provider (enforced by the backend's CSP `connect-src 'self'`
 * and the CI guard). Backend error responses arrive as
 * { error: { code, message } } and are re-thrown as ApiError with the code
 * preserved so the UI can react (retry, hints, offline banner).
 * ========================================================================== */

const DEFAULT_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(code, message, { status = null, cause = undefined } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

async function api(path, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("OFFLINE", "You appear to be offline. Check your connection — we'll retry the moment you're back.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(path, { signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new ApiError("TIMEOUT", "The request timed out. Check your connection and try again.", { cause: err });
    }
    throw new ApiError("NETWORK", "Couldn't reach the SkyCast server. Check your connection and try again.", { cause: err });
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try {
    body = await response.json();
  } catch { /* non-JSON error bodies fall through to the status branch */ }

  if (!response.ok) {
    const code = body?.error?.code ?? `HTTP_${response.status}`;
    const message = body?.error?.message ?? `Request failed (HTTP ${response.status}).`;
    throw new ApiError(code, message, { status: response.status });
  }

  return body;
}

/**
 * Weather aggregate — one call powers the whole dashboard.
 * @param {{city: string} | {lat: number, lon: number}} query
 */
export function fetchWeather(query) {
  return query.city != null
    ? api(`/api/v1/weather?city=${encodeURIComponent(query.city)}`)
    : api(`/api/v1/weather?lat=${query.lat}&lon=${query.lon}`);
}

/** City search (kept for future autocomplete UI). */
export function fetchGeocode(q) {
  return api(`/api/v1/geocode?q=${encodeURIComponent(q)}`);
}
