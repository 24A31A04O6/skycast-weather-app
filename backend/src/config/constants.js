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
 * `connect-src` deliberately includes the three key-less provider hosts the
 * frontend's STANDALONE demo mode still calls directly. This is a temporary,
 * documented exemption (mirrors the CI guard exemption for app.js) and MUST
 * be reduced to 'self' in Phase 4, when the browser routes every request
 * through this backend.
 */
export const CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:"],
  connectSrc: [
    "'self'",
    "https://api.open-meteo.com",
    "https://geocoding-api.open-meteo.com",
    "https://api.bigdatacloud.net",
  ],
  upgradeInsecureRequests: [],
});
