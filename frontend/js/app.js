/* ============================================================================
   SkyCast · Weather App — script.js  (v2 · production-grade revamp)
   ----------------------------------------------------------------------------
   Vanilla JavaScript · zero dependencies · async/await throughout.

   ▸ Primary source : OpenWeatherMap (current weather + 5-day/3-hour forecast)
   ▸ UV supplement  : Open-Meteo hourly UV index (free, key-less — OWM's free
                      plan has no UV endpoint). Fails silently to "—".
   ▸ Demo mode      : full Open-Meteo pipeline — active until you add a key,
                      so the app works out of the box.

   Contents
   ─────────────────────────────────────────────
    1) API configuration          ← ★ INSERT YOUR KEY HERE ★
    2) State & DOM references
    3) SVG icon set (inline, no CDN)
    4) Lookup maps & helpers
    5) Formatting & unit conversion
    6) fetch utilities (timeout + friendly errors)
    7) API layer — normalised data shape from either source
    8) Ambient FX engine (particles / clouds / stars / lightning)
    9) Rendering (hero, hourly slider, 5-day rows, metric tiles)
   10) Skeleton & loading orchestration
   11) Toasts with inline retry
   12) Recent-search chips (localStorage)
   13) Unit toggle (instant °C ⇄ °F, no API call)
   14) Event wiring & init
   ========================================================================== */

"use strict";

/* -----------------------------------------------------------------------------
   1) ★★★ API CONFIGURATION — INSERT YOUR KEY HERE ★★★
   -----------------------------------------------------------------------------
   1. Create a free account:  https://home.openweathermap.org/users/sign_up
   2. Copy your API key:      https://home.openweathermap.org/api_keys
   3. Paste it between the quotes below, e.g.  const API_KEY = "abc123…";

   NOTE: Brand-new OpenWeatherMap keys can take ~10 minutes (occasionally a
   couple of hours) to activate. Until a valid key is provided the app runs in
   DEMO MODE powered by Open-Meteo (https://open-meteo.com) — no key needed.
----------------------------------------------------------------------------- */
const API_KEY = "YOUR_API_KEY_HERE";

const OWM_CURRENT_URL  = "https://api.openweathermap.org/data/2.5/weather";
const OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

/* Key-less helpers (demo mode + UV supplement for OWM mode) */
const GEO_URL        = "https://geocoding-api.open-meteo.com/v1/search";
const METEO_URL      = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEO_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/* City loaded on first paint — change it to whatever you like */
const DEFAULT_CITY = "Hyderabad";

const REQUEST_TIMEOUT_MS = 12000;
const RECENTS_KEY = "skycast:recents";
const UNITS_KEY   = "skycast:units";

/* -----------------------------------------------------------------------------
   2) State & DOM references
----------------------------------------------------------------------------- */
let DEMO_OVERRIDE = false;   // flipped on via the "continue in demo mode" toast action
let lastData = null;         // last successful payload (metric units) — powers instant unit toggling
let lastAction = null;       // last attempted lookup — powers the toast "Retry" button
let skTimer = null;          // delayed-skeleton timer
let fxTimer = null;          // FX cross-fade timer

const $ = (id) => document.getElementById(id);

const el = {
  fx: $("fx"),
  form: $("search-form"),
  input: $("search-input"),
  btn: $("search-btn"),
  gps: $("gps-btn"),
  chips: $("chips"),
  toasts: $("toasts"),
  skeleton: $("skeleton"),
  content: $("content"),
  city: $("city-name"),
  date: $("local-date"),
  iconBox: $("weather-icon"),
  temp: $("temp-value"),
  tempUnit: $("temp-unit"),
  desc: $("weather-desc"),
  hiLo: $("hi-lo"),
  hi: $("hi-value"),
  lo: $("lo-value"),
  hourly: $("hourly"),
  daily: $("daily"),
  mHumidity: $("m-humidity"),
  mWind: $("m-wind"),
  mWindSub: $("m-wind-sub"),
  mFeels: $("m-feels"),
  mUv: $("m-uv"),
  mUvSub: $("m-uv-sub"),
  mVis: $("m-vis"),
  mVisSub: $("m-vis-sub"),
  mPres: $("m-pres"),
  mSunrise: $("m-sunrise"),
  mSunset: $("m-sunset"),
  footer: $("app-footer"),
  unitsToggle: $("units-toggle"),
};

let units = "c";
try {
  units = localStorage.getItem(UNITS_KEY) === "f" ? "f" : "c";
} catch { /* private mode etc. */ }

/* -----------------------------------------------------------------------------
   3) SVG icon set (inline — zero external requests)
----------------------------------------------------------------------------- */
const svgWrap = (inner, sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
  sun: svgWrap(
    `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>` +
    `<line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>` +
    `<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>` +
    `<line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>` +
    `<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`),
  moon: svgWrap(`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`),
  cloudSun: svgWrap(
    `<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/>` +
    `<path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/>` +
    `<path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`),
  cloudMoon: svgWrap(
    `<g transform="translate(10.2,-0.4) scale(0.52)"><path stroke-width="3.8" ` +
    `d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></g>` +
    `<path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`),
  cloud: svgWrap(`<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>`),
  drizzle: svgWrap(
    `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>` +
    `<line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/>` +
    `<line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/>` +
    `<line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/>`),
  rain: svgWrap(
    `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>` +
    `<line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/>` +
    `<line x1="12" y1="15" x2="12" y2="23"/>`),
  thunder: svgWrap(
    `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>` +
    `<polygon points="13 11 9 17 15 17 11 23 13 11"/>`),
  snow: svgWrap(
    `<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>` +
    `<line x1="8" y1="16" x2="8" y2="18"/><line x1="8" y1="12" x2="8" y2="14"/>` +
    `<line x1="16" y1="18" x2="16" y2="20"/><line x1="16" y1="12" x2="16" y2="14"/>` +
    `<line x1="12" y1="14" x2="12" y2="16"/><line x1="12" y1="18" x2="12" y2="20"/>`),
  mist: svgWrap(
    `<line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="13" x2="21" y2="13"/>` +
    `<line x1="8" y1="17" x2="16" y2="17"/>`),
};

const ICON_MINI = {
  pin: svgWrap(`<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`, 2.2),
  drop: svgWrap(`<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>`, 2.4),
  retry: svgWrap(`<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`, 2.4),
  alert: svgWrap(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`),
  info: svgWrap(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`),
  close: svgWrap(`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 2.4),
};

const ICON_COLOR = {
  sun: "#ffd166", moon: "#c3ccff", cloudSun: "#ffdf9e", cloudMoon: "#bfc9f5",
  cloud: "#e6edff", drizzle: "#9fd6ff", rain: "#8ecbff", thunder: "#ffe08a",
  snow: "#d6ecff", mist: "#ccd6e6",
};

/* -----------------------------------------------------------------------------
   4) Lookup maps & small helpers
----------------------------------------------------------------------------- */

const OWM_ICON_MAP = {
  "01d": "sun", "01n": "moon",
  "02d": "cloudSun", "02n": "cloudMoon",
  "03": "cloud", "04": "cloud",
  "09": "drizzle", "10": "rain", "11": "thunder", "13": "snow", "50": "mist",
};

const THEME_BY_ICON = {
  sun: "clear-day", moon: "clear-night",
  cloudSun: "partly-day", cloudMoon: "partly-night",
  cloud: "cloudy", drizzle: "rain", rain: "rain",
  thunder: "storm", snow: "snow", mist: "mist",
};

/* Human-readable WMO weather codes (Open-Meteo) */
const WMO_TEXT = {
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

class AppError extends Error {
  constructor(message, { cause, status } = {}) {
    super(message);
    this.name = "AppError";
    this.cause = cause;
    this.status = status ?? null;
  }
}

const isDemoMode = () =>
  DEMO_OVERRIDE ||
  !API_KEY ||
  API_KEY.trim() === "" ||
  API_KEY.trim() === "YOUR_API_KEY_HERE";

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rnd = (min, max) => min + Math.random() * (max - min);

/** Describe a WMO code → { day, night, fallback } icon keys. */
function describeWMO(code) {
  if (code === 0 || code === 1) return { day: "sun", night: "moon", fallback: "Clear" };
  if (code === 2) return { day: "cloudSun", night: "cloudMoon", fallback: "Partly cloudy" };
  if (code === 3) return { day: "cloud", night: "cloud", fallback: "Overcast" };
  if (code === 45 || code === 48) return { day: "mist", night: "mist", fallback: "Foggy" };
  if (code >= 51 && code <= 57) return { day: "drizzle", night: "drizzle", fallback: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { day: "rain", night: "rain", fallback: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { day: "snow", night: "snow", fallback: "Snow" };
  if (code >= 95) return { day: "thunder", night: "thunder", fallback: "Thunderstorm" };
  return { day: "cloud", night: "cloud", fallback: "Unknown" };
}

function uvLabel(uv) {
  if (!Number.isFinite(uv)) return "—";
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function friendlyHttpError(status, city) {
  switch (status) {
    case 404:
      return `Hmm… we couldn't find “${city}”. Double-check the spelling and try again.`;
    case 401:
      return "Your OpenWeatherMap key was rejected. Check the key in script.js (new keys can take a while to activate).";
    case 429:
      return "Too many requests — the API rate limit was hit. Wait a minute and try again.";
    case 500: case 502: case 503:
      return "The weather service is having trouble right now. Please try again shortly.";
    default:
      return `The weather service returned an unexpected error (HTTP ${status}).`;
  }
}

/* -----------------------------------------------------------------------------
   5) Formatting & unit conversion (all data is stored metric; conversion
      happens only at render time so the °C/°F toggle is instant)
----------------------------------------------------------------------------- */
const toF = (c) => c * 9 / 5 + 32;
const tval = (c) => Math.round(units === "f" ? toF(c) : c);
const tunit = () => (units === "f" ? "°F" : "°C");

const windText = (kmh) =>
  units === "f" ? `${Math.round(kmh / 1.60934)} mph` : `${Math.round(kmh)} km/h`;

const visText = (km) => {
  if (units === "f") {
    const mi = km / 1.60934;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
};

/* — Time helpers (always rendered against UTC, because the underlying
     values are already shifted into the city's local wall-clock) — */
const UTC = { timeZone: "UTC" };

const hourLabelFromH = (h) =>
  new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString(undefined, { ...UTC, hour: "numeric" });

const fmtHourISO = (iso) => hourLabelFromH(+iso.slice(11, 13));

const fmtHourUnix = (shiftedSeconds) =>
  hourLabelFromH(new Date(shiftedSeconds * 1000).getUTCHours());

const dayLabelFromKey = (key) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { ...UTC, weekday: "short" });

const clockFromHM = (hh, mm) =>
  new Date(Date.UTC(2000, 0, 1, hh, mm)).toLocaleTimeString(undefined, { ...UTC, hour: "numeric", minute: "2-digit" });

const fmtClockISO = (iso) => clockFromHM(+iso.slice(11, 13), +iso.slice(14, 16));

const fmtClockUnix = (shiftedSeconds) => {
  const d = new Date(shiftedSeconds * 1000);
  return clockFromHM(d.getUTCHours(), d.getUTCMinutes());
};

const fmtHeroISO = (iso) => {
  const d = new Date(`${iso}:00Z`);
  const date = d.toLocaleDateString(undefined, { ...UTC, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString(undefined, { ...UTC, hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
};

const fmtHeroUnix = (shiftedSeconds) => {
  const d = new Date(shiftedSeconds * 1000);
  const date = d.toLocaleDateString(undefined, { ...UTC, weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString(undefined, { ...UTC, hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
};

/* -----------------------------------------------------------------------------
   6) fetch utilities — timeout via AbortController + friendly errors
----------------------------------------------------------------------------- */
async function fetchJSON(url, { statusMessages = {}, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const message = statusMessages[response.status] ?? friendlyHttpError(response.status, "");
      throw new AppError(message, { status: response.status });
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.name === "AbortError") {
      throw new AppError("The request timed out. Check your connection and try again.", { cause: error });
    }
    throw new AppError("Couldn't reach the weather service. Check your internet connection and try again.", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/* -----------------------------------------------------------------------------
   7) API layer
      Every fetcher resolves to ONE normalised shape:
      {
        source, city, country, lat, lon,
        temp, feelsLike, humidity, windKmh,          (raw metric numbers)
        pressureHpa, visibilityKm, uv,               (any may be null)
        sunriseLabel, sunsetLabel, localTimeLabel,
        iconKey, theme,
        hourly: [{ timeLabel, iconKey, temp, popPct|null }],
        daily:  [{ dateKey, iconKey, min, max, popPct|null }],
      }
----------------------------------------------------------------------------- */

/* — Open-Meteo pipeline (demo mode) — */
async function meteoForecast(lat, lon, city, country) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto", forecast_days: "7",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day,uv_index,visibility,surface_pressure",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
  });
  const data = await fetchJSON(`${METEO_URL}?${params}`);

  const c = data.current ?? {};
  const H = data.hourly ?? {};
  const D = data.daily ?? {};

  let idx = (H.time ?? []).indexOf(c.time);
  if (idx < 0) idx = 0;

  const hourly = [];
  for (let i = idx; i < Math.min(idx + 24, (H.time ?? []).length); i++) {
    const info = describeWMO(H.weather_code?.[i]);
    const iconKey = H.is_day?.[i] ? info.day : info.night;
    hourly.push({
      timeLabel: i === idx ? "Now" : fmtHourISO(H.time[i]),
      iconKey,
      temp: H.temperature_2m?.[i],
      popPct: H.precipitation_probability?.[i] ?? null,
    });
  }

  const daily = [];
  for (let i = 0; i < Math.min(5, (D.time ?? []).length); i++) {
    daily.push({
      dateKey: D.time[i],
      iconKey: describeWMO(D.weather_code?.[i]).day,
      min: D.temperature_2m_min?.[i],
      max: D.temperature_2m_max?.[i],
      popPct: null,
    });
  }

  const curInfo = describeWMO(c.weather_code);
  const iconKey = c.is_day ? curInfo.day : curInfo.night;

  return {
    source: "Open-Meteo",
    city,
    country: country ?? "",
    lat, lon,
    description: WMO_TEXT[c.weather_code] ?? curInfo.fallback,
    temp: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windKmh: c.wind_speed_10m,
    pressureHpa: H.surface_pressure?.[idx] ?? null,
    visibilityKm: H.visibility?.[idx] != null ? H.visibility[idx] / 1000 : null,
    uv: H.uv_index?.[idx] ?? null,
    sunriseLabel: D.sunrise?.[0] ? fmtClockISO(D.sunrise[0]) : null,
    sunsetLabel: D.sunset?.[0] ? fmtClockISO(D.sunset[0]) : null,
    localTimeLabel: c.time ? fmtHeroISO(c.time) : "",
    iconKey,
    theme: THEME_BY_ICON[iconKey] ?? "cloudy",
    hourly,
    daily,
  };
}

async function fetchFromDemo({ city }) {
  const geoUrl = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const geo = await fetchJSON(geoUrl);
  const hit = geo.results?.[0];
  if (!hit) throw new AppError(friendlyHttpError(404, city), { status: 404 });
  return meteoForecast(hit.latitude, hit.longitude, hit.name, hit.country_code ?? "");
}

async function fetchFromDemoCoords({ lat, lon, label }) {
  let city = label ?? null;
  if (!city) city = await reverseGeocode(lat, lon);
  return meteoForecast(lat, lon, city || "My Location", "");
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `${REVERSE_GEO_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const data = await fetchJSON(url, { timeoutMs: 6000 });
    return data.city || data.locality || data.principalSubdivision || null;
  } catch {
    return null; // reverse geocoding is cosmetic — never fail the lookup for it
  }
}

/* — OpenWeatherMap pipeline (your key) — */
function normalizeOwm(cur, fc, uv) {
  const tz = fc?.city?.timezone ?? cur.timezone ?? 0;
  const curIcon = cur.weather?.[0]?.icon ?? "01d";
  const iconKey = OWM_ICON_MAP[curIcon] ?? OWM_ICON_MAP[curIcon.slice(0, 2)] ?? "cloud";

  /* Next 24 h — OWM's free forecast steps in 3-hour blocks → 8 cards */
  const hourly = (fc.list ?? []).slice(0, 8).map((e) => ({
    timeLabel: fmtHourUnix((e.dt ?? 0) + tz),
    iconKey: OWM_ICON_MAP[e.weather?.[0]?.icon ?? "04d"] ?? "cloud",
    temp: e.main?.temp,
    popPct: e.pop != null ? Math.round(e.pop * 100) : null,
  }));

  /* 5 days — aggregate the 3-hour list into per-day min/max + a noon icon */
  const groups = new Map();
  for (const e of fc.list ?? []) {
    const key = new Date(((e.dt ?? 0) + tz) * 1000).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const daily = [...groups].slice(0, 5).map(([dateKey, entries]) => {
    let min = Infinity, max = -Infinity, pop = 0, noon = entries[0], best = 24;
    for (const e of entries) {
      if (typeof e.main?.temp === "number") { min = Math.min(min, e.main.temp); max = Math.max(max, e.main.temp); }
      if (e.pop != null) pop = Math.max(pop, e.pop);
      const h = new Date(((e.dt ?? 0) + tz) * 1000).getUTCHours();
      const dist = Math.abs(h - 12);
      if (dist < best) { best = dist; noon = e; }
    }
    return {
      dateKey,
      iconKey: OWM_ICON_MAP[noon?.weather?.[0]?.icon ?? "04d"] ?? "cloud",
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
      popPct: pop > 0 ? Math.round(pop * 100) : null,
    };
  });

  return {
    source: "OpenWeatherMap",
    city: cur.name || "Unknown location",
    country: cur.sys?.country ?? "",
    lat: cur.coord?.lat,
    lon: cur.coord?.lon,
    temp: cur.main?.temp,
    feelsLike: cur.main?.feels_like,
    humidity: cur.main?.humidity,
    windKmh: (cur.wind?.speed ?? 0) * 3.6, // m/s → km/h
    pressureHpa: cur.main?.pressure ?? null,
    visibilityKm: cur.visibility != null ? cur.visibility / 1000 : null,
    uv,
    sunriseLabel: cur.sys?.sunrise != null ? fmtClockUnix(cur.sys.sunrise + tz) : null,
    sunsetLabel: cur.sys?.sunset != null ? fmtClockUnix(cur.sys.sunset + tz) : null,
    localTimeLabel: cur.dt != null ? fmtHeroUnix(cur.dt + tz) : "",
    iconKey,
    theme: THEME_BY_ICON[iconKey] ?? "cloudy",
    hourly,
    daily,
  };
}

/**
 * OWM's free plan has no UV endpoint, so quietly borrow the current-hour UV
 * from Open-Meteo (free, key-less). Any failure → null ("—" in the UI).
 */
async function fetchUvSupplement(lat, lon, anchorIso) {
  try {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon, timezone: "auto", forecast_days: "2",
      current: "temperature_2m", hourly: "uv_index",
    });
    const data = await fetchJSON(`${METEO_URL}?${params}`, { timeoutMs: 8000 });
    const times = data.hourly?.time ?? [];
    const anchor = (anchorIso ?? "").slice(0, 13);
    let idx = times.findIndex((t) => t.slice(0, 13) === anchor);
    if (idx < 0) idx = times.findIndex((t) => t >= (data.current?.time ?? ""));
    if (idx < 0) idx = 0;
    return data.hourly?.uv_index?.[idx] ?? null;
  } catch {
    return null;
  }
}

async function fetchFromOpenWeather(opts) {
  const where = opts.city != null
    ? `q=${encodeURIComponent(opts.city)}`
    : `lat=${opts.lat}&lon=${opts.lon}`;
  const suffix = `&units=metric&appid=${encodeURIComponent(API_KEY)}`;

  const [cur, fc] = await Promise.all([
    fetchJSON(`${OWM_CURRENT_URL}?${where}${suffix}`, {
      statusMessages: {
        404: friendlyHttpError(404, opts.city ?? "that location"),
        401: friendlyHttpError(401),
      },
    }),
    fetchJSON(`${OWM_FORECAST_URL}?${where}${suffix}`, {
      statusMessages: { 401: friendlyHttpError(401) },
    }),
  ]);

  const anchor = cur.dt != null
    ? new Date((cur.dt + (cur.timezone ?? 0)) * 1000).toISOString().slice(0, 13)
    : "";
  const uv = await fetchUvSupplement(cur.coord?.lat, cur.coord?.lon, anchor);
  return normalizeOwm(cur, fc, uv);
}

/* — Single entry points — */
async function getWeather(opts) {
  return isDemoMode() ? fetchFromDemo(opts) : fetchFromOpenWeather(opts);
}

async function getWeatherByCoords(opts) {
  return isDemoMode() ? fetchFromDemoCoords(opts) : fetchFromOpenWeather(opts);
}

/* -----------------------------------------------------------------------------
   8) Ambient FX engine — builds a themed particle/glow layer per condition
----------------------------------------------------------------------------- */
const fxMarkup = {
  "clear-day": () => `
    <span class="fx-glow"></span>
    ${cloud(2, 0.5)}`,
  "clear-night": () => `
    <span class="fx-glow fx-glow--moon"></span>
    ${stars(60)}${shooting()}`,
  "partly-day": () => `
    <span class="fx-glow fx-glow--soft"></span>
    ${cloud(3, 0.8)}`,
  "partly-night": () => `
    <span class="fx-glow fx-glow--moon"></span>
    ${cloud(3, 0.7)}${stars(20)}`,
  "cloudy": () => cloud(4, 0.9),
  "rain": () => `${cloud(3, 0.9)}${rain(55)}`,
  "storm": () => `${cloud(3, 0.95)}${rain(45)}<span class="fx-lightning" style="--d:${rnd(7, 11).toFixed(1)}s;--delay:${rnd(1, 5).toFixed(1)}s"></span>`,
  "snow": () => `${cloud(2, 0.7)}${snow(45)}`,
  "mist": () => fog(3),
  "default": () => "",
};

const cloud = (n, o) => Array.from({ length: n }, (_, i) =>
  `<span class="fx-cloud" style="--w:${rnd(38, 60).toFixed(0)}vmin;top:${rnd(-6, 34).toFixed(0)}%;` +
  `--d:${rnd(55, 110).toFixed(0)}s;--delay:${(-rnd(0, 90)).toFixed(0)}s;--o:${(o * rnd(0.7, 1)).toFixed(2)}"></span>`
).join("");

const stars = (n) => Array.from({ length: n }, () =>
  `<span class="fx-star" style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(0, 68).toFixed(1)}%;` +
  `--s:${rnd(1.5, 3).toFixed(1)}px;--d:${rnd(2, 5).toFixed(1)}s;--delay:${rnd(0, 4).toFixed(1)}s"></span>`
).join("");

const shooting = () =>
  `<span class="fx-shooting" style="--y:${rnd(8, 28).toFixed(0)}%;--delay:${rnd(2, 8).toFixed(0)}s"></span>`;

const rain = (n) => Array.from({ length: n }, () =>
  `<span class="fx-rain" style="left:${rnd(0, 100).toFixed(1)}%;--len:${rnd(48, 96).toFixed(0)}px;` +
  `--d:${rnd(0.55, 1.05).toFixed(2)}s;--delay:${rnd(0, 1.6).toFixed(2)}s;--tilt:${rnd(7, 12).toFixed(0)}deg"></span>`
).join("");

const snow = (n) => Array.from({ length: n }, () =>
  `<span class="fx-snow" style="left:${rnd(0, 100).toFixed(1)}%;--s:${rnd(3, 7).toFixed(1)}px;` +
  `--d:${rnd(7, 14).toFixed(1)}s;--delay:${rnd(0, 10).toFixed(1)}s;--sway:${rnd(-7, 7).toFixed(1)}vw;` +
  `--o:${rnd(0.45, 0.9).toFixed(2)}"></span>`
).join("");

const fog = (n) => Array.from({ length: n }, (_, i) =>
  `<span class="fx-fog" style="top:${18 + i * 26}%;--h:${rnd(13, 20).toFixed(0)}vh;` +
  `--d:${rnd(38, 70).toFixed(0)}s;--o:${rnd(0.55, 0.85).toFixed(2)}"></span>`
).join("");

const BLOBS = `<span class="fx-blob fx-blob--a"></span><span class="fx-blob fx-blob--b"></span><span class="fx-blob fx-blob--c"></span>`;

function buildFX(theme) {
  clearTimeout(fxTimer);
  el.fx.classList.add("is-fading");
  fxTimer = setTimeout(() => {
    const build = fxMarkup[theme] ?? fxMarkup.default;
    el.fx.innerHTML = BLOBS + build();
    el.fx.classList.remove("is-fading");
  }, 340);
}

/* -----------------------------------------------------------------------------
   9) Rendering
----------------------------------------------------------------------------- */
function renderAll(data, { animate = true } = {}) {
  /* Sky theme, ambient FX and tab title */
  document.body.dataset.theme = data.theme;
  document.title = `SkyCast · ${data.city}`;
  buildFX(data.theme);

  /* — Hero — */
  el.city.textContent = data.country ? `${data.city}, ${data.country}` : data.city;
  el.date.textContent = data.localTimeLabel || "";
  el.iconBox.dataset.icon = data.iconKey;
  el.iconBox.innerHTML = ICONS[data.iconKey] ?? ICONS.cloud;
  el.temp.textContent = Number.isFinite(data.temp) ? tval(data.temp) : "--";
  el.tempUnit.textContent = tunit();
  el.desc.textContent = capitalize(data.description ?? "") || "—";

  const today = data.daily?.[0];
  if (today && Number.isFinite(today.min) && Number.isFinite(today.max)) {
    el.hi.textContent = `${tval(today.max)}°`;
    el.lo.textContent = `${tval(today.min)}°`;
    el.hiLo.hidden = false;
  } else {
    el.hiLo.hidden = true;
  }

  /* — Hourly slider — */
  el.hourly.innerHTML = (data.hourly ?? []).map((h, i) => `
    <div class="hour${h.timeLabel === "Now" ? " hour--now" : ""}" role="listitem">
      <span class="hour__time">${h.timeLabel}</span>
      <span class="hour__icon" style="color:${ICON_COLOR[h.iconKey] ?? "#e6edff"}">${ICONS[h.iconKey] ?? ICONS.cloud}</span>
      <span class="hour__temp">${Number.isFinite(h.temp) ? tval(h.temp) + "°" : "--"}</span>
      <span class="hour__pop">${h.popPct ? ICON_MINI.drop + h.popPct + "%" : ""}</span>
    </div>`).join("");

  /* — 5-day rows with range bars — */
  const days = data.daily ?? [];
  const mins = days.map((d) => d.min).filter(Number.isFinite);
  const maxs = days.map((d) => d.max).filter(Number.isFinite);
  const weekMin = mins.length ? Math.min(...mins) : 0;
  const weekMax = maxs.length ? Math.max(...maxs) : 1;
  const span = Math.max(weekMax - weekMin, 1);

  el.daily.innerHTML = days.map((d, i) => {
    const left = Number.isFinite(d.min) ? ((d.min - weekMin) / span) * 100 : 0;
    const width = Number.isFinite(d.min) && Number.isFinite(d.max)
      ? Math.max(((d.max - d.min) / span) * 100, 6) : 6;
    return `
    <div class="day" role="listitem" style="animation-delay:${i * 55}ms">
      <span class="day__name${i === 0 ? " day__name--today" : ""}">${i === 0 ? "Today" : dayLabelFromKey(d.dateKey)}</span>
      <span class="day__icon" style="color:${ICON_COLOR[d.iconKey] ?? "#e6edff"}">${ICONS[d.iconKey] ?? ICONS.cloud}</span>
      <span class="day__min">${Number.isFinite(d.min) ? tval(d.min) + "°" : "--"}</span>
      <span class="day__bar"><span class="day__bar-fill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
      <span class="day__max">${Number.isFinite(d.max) ? tval(d.max) + "°" : "--"}</span>
    </div>`;
  }).join("");

  /* — Metric tiles — */
  el.mHumidity.textContent = Number.isFinite(data.humidity) ? `${Math.round(data.humidity)}%` : "--";

  el.mWind.textContent = Number.isFinite(data.windKmh) ? windText(data.windKmh) : "--";
  el.mWindSub.textContent = units === "f" ? "Surface wind · mph" : "Surface wind · km/h";

  el.mFeels.textContent = Number.isFinite(data.feelsLike) ? `${tval(data.feelsLike)}${tunit()}` : "--";

  if (Number.isFinite(data.uv)) {
    el.mUv.textContent = data.uv < 10 ? data.uv.toFixed(1) : String(Math.round(data.uv));
    el.mUvSub.textContent = uvLabel(data.uv);
  } else {
    el.mUv.textContent = "--";
    el.mUvSub.textContent = "—";
  }

  if (Number.isFinite(data.visibilityKm)) {
    el.mVis.textContent = visText(data.visibilityKm);
    el.mVisSub.textContent = units === "f" ? "Air clarity · miles" : "Air clarity · km";
  } else {
    el.mVis.textContent = "--";
    el.mVisSub.textContent = "—";
  }

  el.mPres.textContent = Number.isFinite(data.pressureHpa) ? `${Math.round(data.pressureHpa)} hPa` : "--";
  el.mSunrise.textContent = data.sunriseLabel ?? "--";
  el.mSunset.textContent = data.sunsetLabel ?? "--";

  /* — Footer source badge — */
  el.footer.innerHTML = isDemoMode()
    ? `<span class="footer-dot footer-dot--demo"></span> Demo mode · data: ${data.source}`
    : `<span class="footer-dot"></span> Live data: ${data.source}`;

  /* — Reveal (or refresh) + entrance animation — */
  clearTimeout(skTimer);
  el.skeleton.hidden = true;
  el.content.hidden = false;
  el.content.classList.remove("is-refreshing");
  if (animate) {
    el.content.classList.remove("anim-children");
    void el.content.offsetWidth; // restart the staggered entrance
    el.content.classList.add("anim-children");
  }
  renderChips();
}

/* -----------------------------------------------------------------------------
   10) Skeleton & loading orchestration
      • First load (nothing rendered yet)  → skeleton shimmer immediately
      • Subsequent loads (content visible) → content dims subtly; the skeleton
        is deliberately skipped so there is never a jarring layout shift
----------------------------------------------------------------------------- */
function beginLoading() {
  el.btn.disabled = true;
  el.input.setAttribute("aria-busy", "true");
  const firstLoad = el.content.hidden;
  if (firstLoad) {
    el.skeleton.hidden = false;
  } else {
    el.content.classList.add("is-refreshing");
  }
}

function endLoading() {
  el.btn.disabled = false;
  el.input.removeAttribute("aria-busy");
  clearTimeout(skTimer);
  el.skeleton.hidden = true;
  el.content.classList.remove("is-refreshing");
}

/* -----------------------------------------------------------------------------
   11) Toasts — contextual errors & info with inline retry
----------------------------------------------------------------------------- */
function toast({ type = "error", message, actions = [], duration = 9000 }) {
  while (el.toasts.children.length >= 3) el.toasts.lastChild.remove();

  const node = document.createElement("div");
  node.className = `toast${type === "info" ? " toast--info" : ""}`;
  node.setAttribute("role", type === "error" ? "alert" : "status");

  const iconSpan = document.createElement("span");
  iconSpan.innerHTML = type === "error" ? ICON_MINI.alert : ICON_MINI.info;

  const body = document.createElement("div");
  body.className = "toast__msg";
  body.textContent = message; // textContent — safe for any API/city string

  if (actions.length) {
    const row = document.createElement("div");
    row.className = "toast__actions";
    for (const a of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "toast__retry";
      b.innerHTML = `${a.icon ? a.icon : ""}<span></span>`;
      b.querySelector("span").textContent = a.label;
      b.addEventListener("click", () => { close(); a.onClick(); });
      row.appendChild(b);
    }
    body.appendChild(row);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast__close";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.innerHTML = ICON_MINI.close;

  const close = () => {
    if (!node.isConnected) return;
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 260);
  };
  closeBtn.addEventListener("click", close);

  node.append(iconSpan, body, closeBtn);
  el.toasts.prepend(node);
  if (duration) setTimeout(close, duration);
  return { close };
}

const retryAction = { label: "Retry", icon: ICON_MINI.retry, onClick: retryLast };

function retryLast() {
  if (!lastAction) return;
  if (lastAction.kind === "city") loadWeather(lastAction.city);
  else loadByCoords(lastAction.lat, lastAction.lon, lastAction.label);
}

/* -----------------------------------------------------------------------------
   12) Recent-search chips (localStorage)
----------------------------------------------------------------------------- */
let recents = [];
try { recents = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"); }
catch { recents = []; }
if (!Array.isArray(recents)) recents = [];

function addRecent({ city, country, lat, lon }) {
  if (city == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const key = `${city}`.trim().toLowerCase();
  recents = recents.filter(
    (r) => !(r.label.toLowerCase() === key && (r.country ?? "") === (country ?? ""))
  );
  recents.unshift({ label: city, country: country ?? "", lat, lon });
  recents = recents.slice(0, 6);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents)); } catch { /* ignore */ }
  renderChips();
}

function renderChips() {
  if (!recents.length) { el.chips.hidden = true; el.chips.innerHTML = ""; return; }
  el.chips.hidden = false;
  el.chips.innerHTML = "";

  recents.forEach((r, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.style.animationDelay = `${i * 45}ms`;

    const isActive =
      lastData &&
      r.label.toLowerCase() === (lastData.city ?? "").toLowerCase() &&
      (r.country ?? "").toLowerCase() === (lastData.country ?? "").toLowerCase();
    if (isActive) chip.classList.add("is-active");

    const icon = document.createElement("span");
    icon.innerHTML = ICON_MINI.pin;
    chip.appendChild(icon.firstChild);

    const label = document.createElement("span");
    label.textContent = r.label;
    chip.appendChild(label);

    if (r.country) {
      const cc = document.createElement("small");
      cc.textContent = r.country;
      chip.appendChild(cc);
    }

    chip.setAttribute("aria-label", `Show weather for ${r.label}`);
    chip.addEventListener("click", () => loadByCoords(r.lat, r.lon, r.label));
    el.chips.appendChild(chip);
  });
}

/* -----------------------------------------------------------------------------
   13) Unit toggle — instant re-render from cached metric data (no API call)
----------------------------------------------------------------------------- */
function setUnits(next) {
  if (units === next) return;
  units = next;
  try { localStorage.setItem(UNITS_KEY, units); } catch { /* ignore */ }
  syncUnitsUI();
  if (lastData) renderAll(lastData, { animate: false }); // instant swap, zero refetch
}

function syncUnitsUI() {
  el.unitsToggle.dataset.units = units;
  for (const btn of el.unitsToggle.querySelectorAll(".units__btn")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.unit === units));
  }
}

/* -----------------------------------------------------------------------------
   14) Event wiring & init
----------------------------------------------------------------------------- */
async function loadWeather(city) {
  lastAction = { kind: "city", city };
  beginLoading();
  try {
    const data = await getWeather({ city });
    lastData = data;
    addRecent({ city: data.city, country: data.country, lat: data.lat, lon: data.lon });
    renderAll(data);
    el.input.value = "";
    el.input.blur();
  } catch (error) {
    console.error("[SkyCast]", error);
    const actions = [retryAction];
    /* Invalid API key? Offer a one-tap switch to demo mode. */
    if (error?.status === 401 && !isDemoMode()) {
      actions.push({
        label: "Continue in demo mode",
        onClick: () => {
          DEMO_OVERRIDE = true;
          retryLast();
        },
      });
    }
    toast({ type: "error", message: error.message, actions });
  } finally {
    endLoading();
  }
}

async function loadByCoords(lat, lon, label = null) {
  lastAction = { kind: "coords", lat, lon, label };
  beginLoading();
  try {
    const data = await getWeatherByCoords({ lat, lon, label });
    lastData = data;
    addRecent({ city: data.city, country: data.country, lat: data.lat, lon: data.lon });
    renderAll(data);
  } catch (error) {
    console.error("[SkyCast]", error);
    toast({ type: "error", message: error.message, actions: [retryAction] });
  } finally {
    endLoading();
  }
}

async function onGpsClick() {
  if (!("geolocation" in navigator)) {
    toast({ type: "info", message: "Geolocation isn't supported by this browser — try searching for a city instead.", duration: 6000 });
    return;
  }
  el.gps.disabled = true;
  el.gps.classList.add("is-busy");
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    await loadByCoords(
      Number(pos.coords.latitude.toFixed(4)),
      Number(pos.coords.longitude.toFixed(4)),
      null
    );
  } catch (error) {
    const messages = {
      1: "Location access was denied. You can allow it in your browser settings, or simply search for a city.",
      2: "Your location is currently unavailable. Try again in a moment, or search for a city.",
      3: "Locating you took too long. Check your connection and try again.",
    };
    const actions = error?.code === 3 ? [{ label: "Retry", icon: ICON_MINI.retry, onClick: onGpsClick }] : [];
    toast({ type: "error", message: messages[error?.code] ?? "Couldn't determine your location. Try searching for a city instead.", actions });
  } finally {
    el.gps.disabled = false;
    el.gps.classList.remove("is-busy");
  }
}

function onSearch(event) {
  event.preventDefault();
  const city = el.input.value.trim();
  if (!city) {
    toast({ type: "info", message: "Please type a city name — for example “Hyderabad” or “Tokyo”.", duration: 5000 });
    el.input.focus();
    return;
  }
  loadWeather(city);
}

/* Hourly slider: drag-to-scroll on desktop + vertical-wheel → horizontal */
function initHourlyScroller() {
  let dragging = false, startX = 0, startScroll = 0, moved = false;

  el.hourly.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false;
    startX = e.clientX;
    startScroll = el.hourly.scrollLeft;
    el.hourly.setPointerCapture(e.pointerId);
  });
  el.hourly.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) { moved = true; el.hourly.classList.add("is-dragging"); }
    el.hourly.scrollLeft = startScroll - dx;
  });
  const stop = () => { dragging = false; el.hourly.classList.remove("is-dragging"); };
  el.hourly.addEventListener("pointerup", stop);
  el.hourly.addEventListener("pointercancel", stop);

  el.hourly.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.hourly.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function init() {
  syncUnitsUI();
  renderChips();

  el.form.addEventListener("submit", onSearch);
  el.gps.addEventListener("click", onGpsClick);
  el.unitsToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".units__btn");
    if (btn) setUnits(btn.dataset.unit);
  });
  initHourlyScroller();

  loadWeather(DEFAULT_CITY);
}

init();

init();
