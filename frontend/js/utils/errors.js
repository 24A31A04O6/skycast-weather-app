/* ============================================================================
 * SkyCast frontend — js/utils/errors.js
 * ----------------------------------------------------------------------------
 * Backend error codes → extra UI hints. The backend's `message` field is
 * already user-facing copy; this module only adds presentation guidance.
 * ========================================================================== */

export const UX_HINTS = {
  RATE_LIMITED: { duration: 12000 },
  UPSTREAM_CONFIG: { duration: 14000 },
  CITY_NOT_FOUND: { duration: 9000 },
  OFFLINE: { duration: 7000 },
};

export function hintFor(code) {
  return UX_HINTS[code] ?? { duration: 9000 };
}
