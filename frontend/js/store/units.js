/* ============================================================================
 * SkyCast frontend — js/store/units.js
 * ----------------------------------------------------------------------------
 * °C/°F preference (persisted). Pure state — conversion helpers live in
 * utils/format.js; the toggle's re-render hook is wired in main.js.
 * ========================================================================== */

const KEY = "skycast:units";

let units = "c";
try {
  units = localStorage.getItem(KEY) === "f" ? "f" : "c";
} catch { /* storage unavailable (private mode) — default sticks */ }

let listener = null;

export function getUnits() {
  return units;
}

/** @returns {boolean} true when the value actually changed */
export function setUnits(next) {
  if (units === next) return false;
  units = next;
  try { localStorage.setItem(KEY, units); } catch { /* ignore */ }
  listener?.(units);
  return true;
}

export function onUnitsChange(cb) {
  listener = cb;
}

export function syncUnitsUI(toggleEl) {
  toggleEl.dataset.units = units;
  for (const btn of toggleEl.querySelectorAll(".units__btn")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.unit === units));
  }
}
