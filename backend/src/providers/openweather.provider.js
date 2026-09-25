/* ============================================================================
 * SkyCast backend — src/providers/openweather.provider.js
 * ----------------------------------------------------------------------------
 * Adapter: OpenWeatherMap (current weather + 5-day/3-hour forecast).
 *   • current + forecast fetched in parallel (same key, same city clause)
 *   • UV stitched in from key-less Open-Meteo (OWM's free plan has no UV) —
 *     best-effort: failure degrades to uv:null, never fails the request
 *   • normalised to the contract DTO via utils/normalize.js
 * ========================================================================== */
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { fetchJson, toAppError, DEFAULT_TIMEOUT_MS } from "../utils/http.js";
import {
  baseDto, num, owmIconKey, THEME_BY_ICON, WMO_TEXT,
  unixToLocalIso, isoToClock, aggregateOwmDaily, pickUvHour,
} from "../utils/normalize.js";

const PROVIDER = "openweather";

/** Run one OWM call, mapping any failure to the contract's error codes. */
async function owm(url) {
  try {
    return await fetchJson(url, { timeoutMs: DEFAULT_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw toAppError(err.status ?? 0, { provider: "OpenWeatherMap" });
  }
}

const clause = (q) =>
  q.city != null
    ? `q=${encodeURIComponent(q.city)}`
    : `lat=${q.lat}&lon=${q.lon}`;

async function fetchWeather(query) {
  if (!env.OPENWEATHER_API_KEY) {
    throw new AppError(502, "UPSTREAM_CONFIG",
      "OpenWeatherMap is not configured on the server (missing OPENWEATHER_API_KEY).");
  }
  const where = clause(query);
  const suffix = `&units=metric&appid=${encodeURIComponent(env.OPENWEATHER_API_KEY)}`;

  const [current, forecast] = await Promise.all([
    owm(`${env.OPENWEATHER_BASE_URL}/weather?${where}${suffix}`),
    owm(`${env.OPENWEATHER_BASE_URL}/forecast?${where}${suffix}`),
  ]);

  const tz = forecast?.city?.timezone ?? current.timezone ?? 0;
  const localNowIso = unixToLocalIso((current.dt ?? Math.floor(Date.now() / 1000)) + tz);

  /* UV is a nice-to-have — the request must survive its absence. */
  const uv = await fetchUv(current.coord?.lat, current.coord?.lon, localNowIso).catch(() => null);

  return normalize(current, forecast, uv, localNowIso);
}

/** Key-less UV supplement for OWM mode (Open-Meteo hourly uv_index). */
async function fetchUv(lat, lon, anchorLocalIso) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto", forecast_days: "2",
    current: "temperature_2m", hourly: "uv_index",
  });
  const data = await fetchJson(`${env.OPENMETEO_BASE_URL}/forecast?${params}`, { timeoutMs: 8000 });
  return pickUvHour(data.hourly?.time ?? [], data.hourly?.uv_index ?? [], anchorLocalIso);
}

function normalize(current, forecast, uv, localNowIso) {
  const tz = forecast?.city?.timezone ?? current.timezone ?? 0;
  const dto = baseDto(PROVIDER, {
    city: current.name || "Unknown location",
    country: current.sys?.country ?? "",
    lat: num(current.coord?.lat),
    lon: num(current.coord?.lon),
  });

  const w = current.weather?.[0] ?? {};
  const iconKey = owmIconKey(w.icon ?? "04d");

  dto.current = {
    temp: num(current.main?.temp),
    feelsLike: num(current.main?.feels_like),
    humidity: num(current.main?.humidity),
    windKmh: typeof current.wind?.speed === "number" ? current.wind.speed * 3.6 : null, // m/s → km/h
    pressureHpa: num(current.main?.pressure),
    visibilityKm: typeof current.visibility === "number" ? current.visibility / 1000 : null,
    uv,
    description: w.description ?? WMO_TEXT[-1] ?? null,
    iconKey,
    theme: THEME_BY_ICON[iconKey] ?? "cloudy",
    sunrise: current.sys?.sunrise != null ? isoToClock(unixToLocalIso(current.sys.sunrise + tz)) : null,
    sunset: current.sys?.sunset != null ? isoToClock(unixToLocalIso(current.sys.sunset + tz)) : null,
    localTime: localNowIso,
  };

  dto.hourly = (forecast.list ?? []).slice(0, 8).map((e) => {
    const info = owmIconKey(e.weather?.[0]?.icon ?? "04d");
    return {
      time: unixToLocalIso((e.dt ?? 0) + tz),
      temp: num(e.main?.temp),
      iconKey: info,
      popPct: typeof e.pop === "number" ? Math.round(e.pop * 100) : 0,
    };
  });

  dto.daily = aggregateOwmDaily(forecast.list ?? [], tz, 5);

  return dto;
}

/** OWM forward geocoding — powers /api/v1/geocode in OWM mode. */
async function geocode(q) {
  try {
    const data = await fetchJson(
      `${env.OPENWEATHER_GEO_URL}/direct?q=${encodeURIComponent(q)}&limit=5&appid=${encodeURIComponent(env.OPENWEATHER_API_KEY)}`
    );
    return (data ?? []).map((h) => ({
      name: h.name,
      country: h.country ?? "",
      state: h.state ?? null,
      lat: h.lat,
      lon: h.lon,
    }));
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw toAppError(err.status ?? 0, { provider: "OpenWeatherMap geocoding" });
  }
}

async function reverse(lat, lon) {
  try {
    const data = await fetchJson(
      `${env.OPENWEATHER_GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${encodeURIComponent(env.OPENWEATHER_API_KEY)}`
    );
    const hit = data?.[0];
    return hit ? { name: hit.name, country: hit.country ?? "" } : null;
  } catch {
    return null; // cosmetic — never fail a coordinates lookup for a missing label
  }
}

export const openweatherProvider = {
  name: PROVIDER,
  isConfigured: () => Boolean(env.OPENWEATHER_API_KEY),
  fetchWeather,
  geocode,
  reverse,
};
