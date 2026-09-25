/* ============================================================================
 * SkyCast backend — src/config/constants.js
 * ----------------------------------------------------------------------------
 * Static configuration: API prefix, error-code vocabulary (the contract's
 * error shape is { error: { code, message } }), and the CSP the browser
 * enforces on the served frontend.
 * ========================================================================== */

export const API_PREFIX = "/api/v1";

/** Stable, frontend-facing error codes (see ARCHITECTURE.md §2.1). */
export const ERROR_CODES = Object.freeze({
  NOT_FOUND: "NOT_FOUND",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  BAD_QUERY: "BAD_QUERY",
  CITY_NOT_FOUND: "CITY_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  UPSTREAM_DOWN: "UPSTREAM_DOWN",
  UPSTREAM_CONFIG: "UPSTREAM_CONFIG",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

/*
 * Content-Security-Policy applied to everything this server serves.
 *
 * `connect-src 'self'` is the ARCHITECTURE.md §1 enforcement: the browser
 * physically cannot call any weather provider — every data request must be
 * a same-origin /api/v1 call. (Since Phase 4 the frontend has zero provider
 * knowledge; this header guarantees it stays that way.)
 */
export const CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"],
  upgradeInsecureRequests: [],
});
