/* ============================================================================
 * SkyCast backend — src/utils/normalize.js
 * ----------------------------------------------------------------------------
 * PURE transforms (no fetch, no clock, no env) — the contract's law-book.
 * Every provider payload passes through here before leaving the backend:
 *   • icon vocabularies (OWM icon codes, WMO weather codes → iconKey/theme)
 *   • time helpers (city-local ISO strings, clocks, day keys)
 *   • OWM aggregation (3-hour steps → per-day min/max + noon icon + pop)
 * Ported from the frontend (frontend/js/app.js) so the UI vocabulary is
 * byte-compatible: the renderer keeps working against the backend DTO.
 * ========================================================================== */

/* ── Icon vocabulary ─────────────────────────────────────────────────────── */

/** OpenWeatherMap icon code → internal icon key (d = day, n = night). */
export const OWM_ICON_MAP = {
  "01d": "sun", "01n": "moon",
  "02d": "cloudSun", "02n": "cloudMoon",
  "03": "cloud", "04": "cloud",
  "09": "drizzle", "10": "rain", "11": "thunder", "13": "snow", "50": "mist",
};

/** iconKey → frontend sky theme (mirrors frontend/styles sky engine). */
export const THEME_BY_ICON = {
  sun: "clear-day", moon: "clear-night",
  cloudSun: "partly-day", cloudMoon: "partly-night",
  cloud: "cloudy", drizzle: "rain", rain: "rain",
  thunder: "storm", snow: "snow", mist: "mist",
};

/** Human-readable WMO weather codes (Open-Meteo). */
export const WMO_TEXT = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Violent showers",
  85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorm", 96: "Thunderstorm · hail", 99: "Thunderstorm · hail",
};

/** OWM icon code → iconKey ("04n" → cloud via the suffix-less map). */
export function owmIconKey(code) {
  return OWM_ICON_MAP[code] ?? OWM_ICON_MAP[String(code).slice(0, 2)] ?? "cloud";
}

/** WMO weather code → { day, night, fallback } icon keys. */
export function describeWMO(code) {
  if (code === 0 || code === 1) return { day: "sun", night: "moon", fallback: "Clear" };
  if (code === 2) return { day: "cloudSun", night: "cloudMoon", fallback: "Partly cloudy" };
  if (code === 3) return { day: "cloud", night: "cloud", fallback: "Overcast" };
  if (code === 45 || code === 48) return { day: "mist", night: "mist", fallback: "Foggy" };
  if (code >= 51 && code <= 57) return { day: "drizzle", night: "drizzle", fallback: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { day: "rain", night: "rain", fallback: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { day: "snow", night: "snow", fallback: "Snow" };
  if (code >= 95 && code <= 99) return { day: "thunder", night: "thunder", fallback: "Thunderstorm" };
  return { day: "cloud", night: "cloud", fallback: "Unknown" };
}

/* ── Time helpers — city-local wall clock, ISO without offsets ───────────── */

const pad = (n) => String(n).padStart(2, "0");

/** Unix seconds (already shifted into the city's frame) → "YYYY-MM-DDTHH:mm". */
export function unixToLocalIso(shiftedSeconds) {
  const d = new Date(shiftedSeconds * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
         `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "2026-09-22T22:15" → "22:15" */
export const isoToClock = (iso) => (iso ? iso.slice(11, 16) : null);

/** Truncate a local ISO string to whole hours: "…T22:15" → "…T22:00". */
export const isoToHour = (iso) => (iso ? `${iso.slice(0, 13)}:00` : null);

/** Local ISO → "YYYY-MM-DD" day key. */
export const isoToDayKey = (iso) => (iso ? iso.slice(0, 10) : null);

/* ── Shared DTO scaffolding ──────────────────────────────────────────────── */

/** Base DTO with meta stamp — adapters fill in the weather. */
export function baseDto(source, place, fetchedAt = new Date()) {
  return {
    source,
    place,
    current: {
      temp: null, feelsLike: null, humidity: null, windKmh: null,
      pressureHpa: null, visibilityKm: null, uv: null,
      description: null, iconKey: "cloud", theme: "cloudy",
      sunrise: null, sunset: null, localTime: null,
    },
    hourly: [],
    daily: [],
    meta: { cached: false, fetchedAt: fetchedAt.toISOString() },
  };
}

/** Aggregate raw OWM 3-hourly entries into per-day DTO rows (min/max/noon icon/pop). */
export function aggregateOwmDaily(entries, tzSeconds, maxDays = 5) {
  const groups = new Map();
  for (const e of entries) {
    const localIso = unixToLocalIso((e.dt ?? 0) + tzSeconds);
    const key = localIso.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...e, __localIso: localIso });
  }

  const days = [];
  for (const [date, rows] of groups) {
    let min = Infinity;
    let max = -Infinity;
    let pop = 0;
    let noon = rows[0];
    let best = 24;
    for (const r of rows) {
      if (typeof r.main?.temp_min === "number") min = Math.min(min, r.main.temp_min);
      if (typeof r.main?.temp_max === "number") max = Math.max(max, r.main.temp_max);
      if (typeof r.main?.temp === "number") {
        min = Math.min(min, r.main.temp);
        max = Math.max(max, r.main.temp);
      }
      if (typeof r.pop === "number") pop = Math.max(pop, r.pop);
      const dist = Math.abs(new Date(`${r.__localIso}:00Z`).getUTCHours() - 12);
      if (dist < best) { best = dist; noon = r; }
    }
    days.push({
      date,
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
      iconKey: owmIconKey(noon?.weather?.[0]?.icon ?? "04d"),
      popPct: pop > 0 ? Math.round(pop * 100) : 0,
    });
  }
  return days.slice(0, maxDays);
}

/** Pick the UV index for the current hour out of Open-Meteo hourly arrays. */
export function pickUvHour(times, uvIndex, anchorHourIso) {
  if (!Array.isArray(times) || !Array.isArray(uvIndex)) return null;
  let idx = times.findIndex((t) => String(t).slice(0, 13) === anchorHourIso.slice(0, 13));
  if (idx < 0) idx = times.findIndex((t) => String(t) >= anchorHourIso.slice(0, 13) + ":00");
  if (idx < 0) idx = 0;
  const uv = uvIndex[idx];
  return typeof uv === "number" ? uv : null;
}

/** A number that is actually a number (not NaN/undefined/null) — else null. */
export const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
