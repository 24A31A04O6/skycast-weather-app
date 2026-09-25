/* ============================================================================
 * SkyCast frontend — js/utils/format.js
 * ----------------------------------------------------------------------------
 * Presentation formatting. ALL weather data arrives metric (°C, km/h, km) —
 * conversion to °F/mph happens here, at render time only, which is what
 * makes the unit toggle instant with zero refetches.
 *
 * Time helpers work on the backend's city-local ISO strings (no offset
 * suffix), formatted against UTC so the city's wall clock is preserved.
 * ========================================================================== */
import { getUnits } from "../store/units.js";

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const toF = (c) => (c * 9) / 5 + 32;

export const tval = (c) => Math.round(getUnits() === "f" ? toF(c) : c);
export const tunit = () => (getUnits() === "f" ? "°F" : "°C");

export const windText = (kmh) =>
  getUnits() === "f" ? `${Math.round(kmh / 1.60934)} mph` : `${Math.round(kmh)} km/h`;

export const visText = (km) => {
  if (getUnits() === "f") {
    const mi = km / 1.60934;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
};

const UTC = { timeZone: "UTC" };
const pad = (n) => String(n).padStart(2, "0");

/** "2026-09-25T20:30" → "Thursday, September 25 · 8:30 PM" (city wall clock). */
export function heroDateTime(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, { ...UTC, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString(undefined, { ...UTC, hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** Hour-of-day from a local ISO string → "1 PM" style label. */
export function hourLabel(iso) {
  const h = Number(iso?.slice(11, 13) ?? 0);
  return new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString(undefined, { ...UTC, hour: "numeric" });
}

/** "06:05" → "6:05 AM" */
export function clock12(hhmm) {
  if (!hhmm) return "--";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(undefined, { ...UTC, hour: "numeric", minute: "2-digit" });
}

/** "2026-09-27" → "Sat" */
export function dayLabel(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(undefined, { ...UTC, weekday: "short" });
}

export function uvLabel(uv) {
  if (!Number.isFinite(uv)) return "—";
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}
