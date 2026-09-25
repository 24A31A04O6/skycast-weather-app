/* ============================================================================
 * SkyCast backend — src/providers/openmeteo.provider.js
 * ----------------------------------------------------------------------------
 * Adapter: Open-Meteo (key-less) — the failover backup AND the only provider
 * while no OPENWEATHER_API_KEY is configured.
 *   • { city } → Open-Meteo geocoding first, then the forecast bundle
 *   • { lat, lon } → reverse label via BigDataCloud (cosmetic, best-effort)
 *   • one forecast call yields current + hourly + daily + uv + visibility +
 *     pressure + sunrise/sunset — no stitching required
 * ========================================================================== */
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { fetchJson, toAppError } from "../utils/http.js";
import {
  baseDto, num, describeWMO, THEME_BY_ICON, WMO_TEXT,
  isoToClock, isoToDayKey, isoToHour,
} from "../utils/normalize.js";

const PROVIDER = "openmeteo";

async function meteo(url, timeoutMs) {
  try {
    return await fetchJson(url, { timeoutMs: timeoutMs ?? 10_000 });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw toAppError(err.status ?? 0, { provider: "Open-Meteo" });
  }
}

/* ── Geocoding ─────────────────────────────────────────────────────────────── */

async function geocode(q) {
  const url = `${env.OPENMETEO_GEOCODE_URL}/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const data = await meteo(url, 8000);
  return (data.results ?? []).map((h) => ({
    name: h.name,
    country: h.country_code ?? "",
    state: h.admin1 ?? null,
    lat: h.latitude,
    lon: h.longitude,
  }));
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `${env.REVERSE_GEO_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const data = await fetchJson(url, { timeoutMs: 6000 });
    const name = data.city || data.locality || data.principalSubdivision || null;
    return name ? { name, country: data.countryCode ?? "" } : null;
  } catch {
    return null; // cosmetic — never fail a coordinates lookup for a missing label
  }
}

/* ── Weather ──────────────────────────────────────────────────────────────── */

async function resolvePlace(query) {
  if (query.lat != null && query.lon != null) {
    const label = await reverseGeocode(query.lat, query.lon);
    return { lat: query.lat, lon: query.lon, city: label?.name ?? "My Location", country: label?.country ?? "" };
  }
  const hits = await geocode(query.city);
  if (!hits.length) {
    throw new AppError(404, "CITY_NOT_FOUND",
      `We couldn't find “${query.city}”. Double-check the spelling and try again.`);
  }
  const h = hits[0];
  return { lat: h.lat, lon: h.lon, city: h.name, country: h.country };
}

async function fetchWeather(query) {
  const place = await resolvePlace(query);

  const params = new URLSearchParams({
    latitude: place.lat,
    longitude: place.lon,
    timezone: "auto",
    forecast_days: "7",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day,uv_index,visibility,surface_pressure",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
  });

  const data = await meteo(`${env.OPENMETEO_BASE_URL}/forecast?${params}`);
  return normalize(place, data);
}

function normalize(place, data) {
  const dto = baseDto(PROVIDER, {
    city: place.city,
    country: place.country,
    lat: num(place.lat),
    lon: num(place.lon),
  });

  const c = data.current ?? {};
  const H = data.hourly ?? {};
  const D = data.daily ?? {};

  let idx = (H.time ?? []).indexOf(c.time);
  if (idx < 0) idx = 0;

  const curInfo = describeWMO(c.weather_code);
  const curIcon = c.is_day ? curInfo.day : curInfo.night;

  dto.current = {
    temp: num(c.temperature_2m),
    feelsLike: num(c.apparent_temperature),
    humidity: num(c.relative_humidity_2m),
    windKmh: num(c.wind_speed_10m),
    pressureHpa: num(H.surface_pressure?.[idx]),
    visibilityKm: H.visibility?.[idx] != null ? H.visibility[idx] / 1000 : null,
    uv: num(H.uv_index?.[idx]),
    description: WMO_TEXT[c.weather_code] ?? curInfo.fallback,
    iconKey: curIcon,
    theme: THEME_BY_ICON[curIcon] ?? "cloudy",
    sunrise: D.sunrise?.[0] ? isoToClock(D.sunrise[0]) : null,
    sunset: D.sunset?.[0] ? isoToClock(D.sunset[0]) : null,
    localTime: c.time ?? null,
  };

  dto.hourly = [];
  for (let i = idx; i < Math.min(idx + 24, (H.time ?? []).length); i++) {
    const info = describeWMO(H.weather_code?.[i]);
    dto.hourly.push({
      time: isoToHour(H.time[i]) ?? H.time[i],
      temp: num(H.temperature_2m?.[i]),
      iconKey: H.is_day?.[i] ? info.day : info.night,
      popPct: typeof H.precipitation_probability?.[i] === "number"
        ? Math.round(H.precipitation_probability[i])
        : 0,
    });
  }

  dto.daily = (D.time ?? []).slice(0, 5).map((date, i) => {
    const info = describeWMO(D.weather_code?.[i]);
    return {
      date: isoToDayKey(date),
      min: num(D.temperature_2m_min?.[i]),
      max: num(D.temperature_2m_max?.[i]),
      iconKey: info.day,
      popPct: 0, // daily precipitation probability not part of the bundle (yet)
    };
  });

  return dto;
}

export const openmeteoProvider = {
  name: PROVIDER,
  isConfigured: () => true, // key-less — always available as the chain's floor
  fetchWeather,
  geocode,
  reverse: reverseGeocode,
};
