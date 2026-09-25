/* ============================================================================
 * SkyCast frontend — js/store/state.js
 * ----------------------------------------------------------------------------
 * Volatile UI state. The last successful payload is kept ONLY as a display
 * cache (instant °C⇄°F repaint) — the backend remains the sole source of
 * truth; nothing weather-related is persisted to localStorage.
 * ========================================================================== */

export const state = {
  /** Last successful contract DTO — powers the instant unit toggle. */
  lastData: null,
  /** Retry thunk for the most recent lookup — powers toast "Retry". */
  lastAction: null,
};

export function setLastData(dto) {
  state.lastData = dto;
}

export function setLastAction(thunk) {
  state.lastAction = thunk;
}

export function retryLast() {
  state.lastAction?.();
}
