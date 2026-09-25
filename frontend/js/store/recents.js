/* ============================================================================
 * SkyCast frontend — js/store/recents.js
 * ----------------------------------------------------------------------------
 * Recent-city chips (persisted). Stores coordinates + label so switching
 * cities replays a precise lat/lon lookup instead of re-searching.
 * ========================================================================== */

const KEY = "skycast:recents";
const MAX = 6;

let recents = [];
try {
  const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  if (Array.isArray(parsed)) recents = parsed;
} catch { recents = []; }

export function getRecents() {
  return recents;
}

export function addRecent({ city, country, lat, lon }) {
  if (city == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const label = String(city).trim().toLowerCase();
  recents = recents.filter(
    (r) => !(r.label.toLowerCase() === label && (r.country ?? "") === (country ?? ""))
  );
  recents.unshift({ label: city, country: country ?? "", lat, lon });
  recents = recents.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(recents)); } catch { /* ignore */ }
}
